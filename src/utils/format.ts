export function formatText(message: string, params: Record<string, string>): string {
    return message.replace(/{([^}]+)}/g, (_, key) => params[key] ?? "");
}

export function formatList(values: any[], sep: string = ", "): string {
    return values.filter(v => v != null && v !== '').map(v => `'${v}'`).join(sep);
}

export const DEFAULT_INDENT = 4;