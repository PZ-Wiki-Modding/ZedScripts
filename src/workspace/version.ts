import * as vscode from 'vscode';
import fs from 'fs';
import * as path from 'path';

import { scriptFileVersionCatcher } from '../models/regexPatterns';

export enum VersionType {
    PRE_42 = "pre_42",
    POST_42 = "post_42",
    COMMON = "common",
    ANY = "any",
    BASE_GAME = "base_game",
}

export class Version {
    static COMMON = new Version(VersionType.COMMON);
    static ANY = new Version(VersionType.ANY);
    static PRE_42 = new Version(VersionType.PRE_42);
    static BASE_GAME = new Version(VersionType.BASE_GAME);

    source: string;
    type: VersionType = VersionType.ANY;
    minor: number = 0;
    major: number = 0;
    isCommon: boolean = false;

    /**
     * Creates a Version instance from a version string.
     * If it is a known version type (common, any, pre_42), it will return the corresponding static instance.
     */
    static fromString(versionStr: string): Version {
        if (versionStr === VersionType.COMMON) {
            return Version.COMMON;
        } else if (versionStr === VersionType.ANY) {
            return Version.ANY;
        } else if (versionStr === VersionType.PRE_42) {
            return Version.PRE_42;
        } else if (versionStr === VersionType.BASE_GAME) {
            return Version.BASE_GAME;
        }
        return new Version(versionStr);
    }

    constructor(source: string) {
        this.source = source;
        this.analyzeSource();
    }

    private analyzeSource(): void {
        // check if VersionType
        if (this.source === VersionType.ANY) {
            this.type = VersionType.ANY;
            return;
        } else if (this.source === VersionType.COMMON) {
            this.type = VersionType.COMMON;
            this.isCommon = true;
            return;
        } else if (this.source === VersionType.PRE_42) {
            this.type = VersionType.PRE_42;
            return;
        }

        // split by `.`
        const parts = this.source.split('.');
        if (parts.length === 0) {
            console.warn(`Invalid version string: ${this.source}`);
            this.type = VersionType.ANY;
            return;
        }

        // retrieve major version
        const major = parseInt(parts[0]);
        if (isNaN(major)) {
            console.warn(`Invalid major version number: ${parts[0]} in version string: ${this.source}`);
            this.type = VersionType.ANY;
            return;
        } else if (major < 42) {
            console.warn(`Version ${this.source} is less than 42, which is not supported. Defaulting to ANY.`);
            this.type = VersionType.ANY;
            return;
        }

        // retrieve minor version
        const minor = parts.length > 1 ? parseInt(parts[1]) : 0;
        if (isNaN(minor)) {
            console.warn(`Invalid minor version number: ${parts[1]} in version string: ${this.source}`);
            this.type = VersionType.ANY;
            return;
        }

        // other parts are unused by the game, but the game still accepts them
        // so we simply ignore them

        this.major = major;
        this.minor = minor;
        this.type = VersionType.POST_42;
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
    if (match && match.groups) {
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
            console.debug(`Found base game folder: ${base}, checking for projectzomboid.jar...`);

            // using the match, we can retrieve the path of the base
            const basePath = pathStr.substring(0, match.index + base.length);
            console.debug(`Base path: ${basePath}`);
            const jarPath = path.join(basePath, 'projectzomboid.jar');
            const jarExists = fs.existsSync(jarPath) && fs.statSync(jarPath).isFile();
            if (jarExists) {
                console.debug(`Found projectzomboid.jar at ${jarPath}, this is the base game folder.`);
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
    }

    // we default to not having any versioning
    return Version.ANY;
}
