import * as path from "path";

export function preparePath(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/'); // normalize to unix-style path
    return path.posix.normalize(normalizedPath); // resolve relative segments
}