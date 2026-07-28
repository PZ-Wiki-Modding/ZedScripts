export enum CompletionText {
    BLOCK = `{scriptBlock} {id}{\n`,
    // MIDDLE = '',
    END = '}',
    ID = `\${{level}:id} `,

    PARAMETER_AUTO = `{parameter} = \${1:value},`,
    PARAMETER = `\t{parameter} = {value},\n`,
}