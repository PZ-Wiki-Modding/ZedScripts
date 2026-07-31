import * as vscode from 'vscode';
import fs from 'fs';
import * as path from 'path';

import { scriptFileVersionCatcher } from '../models/regexPatterns';

export enum VersionType {
    _TEMP = "_temp",
    PRE_42 = "pre_42",
    POST_42 = "post_42",
    COMMON = "common",
    ANY = "any",
    BASE_GAME = "base_game",
}

export class Version {
    static _TEMP = new Version(VersionType._TEMP); // should not be used for anything
    static COMMON = new Version(VersionType.COMMON);
    static ANY = new Version(VersionType.ANY);
    static PRE_42 = new Version(VersionType.PRE_42);
    static BASE_GAME = new Version(VersionType.BASE_GAME);
    static VERSION_MAP = new Map<string, Version>([
        [VersionType.COMMON, Version.COMMON],
        [VersionType.ANY, Version.ANY],
        [VersionType.PRE_42, Version.PRE_42],
        [VersionType.BASE_GAME, Version.BASE_GAME],
    ]);

    source: string;
    type: VersionType = VersionType.ANY;
    minor: number = 0;
    major: number = 0;

    isCommon: boolean = false;
    isAny: boolean = false;
    isPre42: boolean = false;
    isBaseGame: boolean = false;
    usesVersioning: boolean = false;

    /**
     * Creates a Version instance from a version string.
     * If it is a known version type (common, any, pre_42), it will return the corresponding static instance.
     */
    public static fromString(versionStr: string): Version {
        // skip if _temp
        if (versionStr === VersionType._TEMP) {
            return Version._TEMP;
        }

        // see if that version already exists
        if (Version.VERSION_MAP.has(versionStr)) {
            return Version.VERSION_MAP.get(versionStr)!;
        }
        // else, we create a new version instance
        const version = new Version(versionStr);
        Version.VERSION_MAP.set(versionStr, version);
        return version;
    }

    public toString(): string {
        if (this.isCommon || this.isAny || this.isPre42 || this.isBaseGame) {
            return this.source;
        }
        return `${this.major}.${this.minor}`;
    }

    public toStringSafe(): string {
        if (this.isCommon || this.isAny || this.isPre42 || this.isBaseGame) {
            return this.source;
        }

        // for versioning, to easily compare, we safe the major and minor version so units are aligned
        // e.g., 42.0 becomes 042.0000 and 42.1 becomes 042.0001
        // this should ensure proper comparison between 42.1 and 42.10 for example
        const majorStr = this.major.toString().padStart(3, '0'); // pad major to 3 digits
        const minorStr = this.minor.toString().padStart(4, '0'); // pad minor to 4 digits
        return `${majorStr}.${minorStr}`;
    }

    public static toStringSafeStatic(versionStr: string): string {
        // modify the temporary version instance
        const version = Version._TEMP;
        version.source = versionStr;
        version.analyzeSource(); // update its properties
        return version.toStringSafe(); // safe it
    }

    constructor(source: string) {
        this.source = source;
        this.analyzeSource();
    }

    private analyzeSource(): void {
        // check if VersionType
        if (this.source === VersionType.ANY) {
            this.type = VersionType.ANY;
            this.isAny = true;
            return;
        } else if (this.source === VersionType.COMMON) {
            this.type = VersionType.COMMON;
            this.isCommon = true;
            return;
        } else if (this.source === VersionType.PRE_42) {
            this.type = VersionType.PRE_42;
            this.isPre42 = true;
            return;
        } else if (this.source === VersionType.BASE_GAME) {
            this.type = VersionType.BASE_GAME;
            this.isBaseGame = true;
            return;
        } else if (this.source === VersionType._TEMP) {
            this.type = VersionType._TEMP;
            return;
        }

        // split by `.`
        const parts = this.source.split('.');
        if (parts.length === 0) {
            console.warn(`Invalid version string, this is an unexpected behavior: ${this.source}`);
            this.type = VersionType.ANY;
            return;
        }

        // retrieve major version
        const major = parseInt(parts[0]);
        if (isNaN(major)) {
            console.warn(`Invalid major version number: ${parts[0]} in version string: ${this.source}`);
            vscode.window.showWarningMessage(`Invalid major version number: '${parts[0]}' in version string: '${this.source}'. Should be an integer.`);
            this.type = VersionType.ANY;
            return;
        } else if (major < 42) {
            console.warn(`Version ${this.source} is less than 42, which is not supported. Defaulting to ANY.`);
            vscode.window.showWarningMessage(`Version folder '${this.source}' is less than 42, which is not supported.`);
            this.type = VersionType.ANY;
            return;
        }

        // retrieve minor version
        const minor = parts.length > 1 ? parseInt(parts[1]) : 0;
        if (isNaN(minor)) {
            console.warn(`Invalid minor version number: ${parts[1]} in version string: ${this.source}`);
            vscode.window.showWarningMessage(`Invalid minor version number: '${parts[1]}' in version string: '${this.source}'. Should be an integer.`);
            this.type = VersionType.ANY;
            return;
        }

        // other parts are unused by the game, but the game still accepts them
        // so we simply ignore them

        this.major = major;
        this.minor = minor;
        this.type = VersionType.POST_42;
        this.usesVersioning = true;
    }


// COMPARATORS

    public static filter(versions: Version[]): Version[] {
        // we filter out to keep only the versioning versions
        return versions.filter(v => v.usesVersioning);
    }

    public findClosestBelow(others: Version[]): Version | null {
        // remove invalid versions
        // technically we already do that, but we do it again to be sure
        const filtered = Version.filter(others);

        // compare by safe string
        const stringCompare = this.toStringSafe();
        const othersString = filtered.map(v => v.toStringSafe());

        // see if one is equal to the source version
        if (othersString.includes(stringCompare)) {
            return this; // we found an exact match
        }

        // if the current version doesn't use versioning
        // we use the latest version of script files
        if (!this.usesVersioning) {
            // sort by their safe string
            othersString.sort();

            // we return the last one, which is the latest version in filtered
            const latestStr = othersString[othersString.length - 1];
            const latestVersion = filtered.find(v => v.toStringSafe() === latestStr);
            return latestVersion || null;
        }

        // insert the source version
        othersString.push(stringCompare);

        // sort by their safe string
        othersString.sort();

        let closest: string;

        // find the position of the source version in the sorted array
        const index = othersString.indexOf(stringCompare);
        if (index > 0) {
            // there is a version before it, which is the closest under
            const closestStr = othersString[index - 1];
            closest = closestStr;
        } else if (index === 0 && othersString.length > 1) {
            // there is no version before it, so we pick above
            const closestStr = othersString[index + 1];
            closest = closestStr;
        } else {
            // there is no other version, so we return null
            // but this is not a normal case, since we verified the array isn't empty
            console.warn('No other version found to compare with, this is unexpected behavior.');
            return null;
        }

        // find the Version instance corresponding to the closest string
        const closestVersion = filtered.find(v => v.toStringSafe() === closest);
        if (!closestVersion) {
            console.warn(`Closest version string ${closest} does not correspond to any Version instance.`);
            return null;
        }

        return closestVersion;
    }
}

export function findWorkspaceVersion(pathStr: string): Version {
    // check for media type versioning
    if (!pathStr.includes('media')) {
        // we default to not having any versioning
        return Version.ANY;
    }

    // fetch information from path
    const match = scriptFileVersionCatcher.exec(pathStr);
    if (!match || !match.groups) { 
        return Version.ANY; 
    }

    // find 42+ versioning
    const version = match.groups['version'];
    if (version) {
        return Version.fromString(version);
    }

    // verify if it is the PZ source folder which doesn't use versioning folders
    // linux uses projectzomboid while windows uses ProjectZomboid
    const base = match.groups['base'];
    if (base === 'projectzomboid' || base === 'ProjectZomboid') {
        // we can check that in the base folder there is a `projectzomboid.jar` file
        // which would mean it is B42
        // using the match, we can retrieve the path of the base
        const basePath = pathStr.substring(0, match.index + base.length);
        const jarPath = path.join(basePath, 'projectzomboid.jar');
        const jarExists = fs.existsSync(jarPath) && fs.statSync(jarPath).isFile();
        if (jarExists) {
            return Version.BASE_GAME;
        }
    }

    // else, we see if this is a B41 file
    const media = match.groups['media'];
    const modinfo = match.groups['modinfo'];
    if (media || modinfo) {
        // it has a media but no versioning, so it must be a B41 file
        // we also identify stranded mod.info files as B41 files
        return Version.PRE_42;
    }

    // we default to not having any versioning
    return Version.ANY;
}
