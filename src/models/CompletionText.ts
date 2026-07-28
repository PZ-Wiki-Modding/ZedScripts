export enum CompletionText {
    BLOCK = `<scriptBlock> <id>{\n`,
    END = '}',
    ID = `\${<level>:id} `, // extra space so in BLOCK, <id> is followed by a space when ID is present

    PARAMETER_AUTO = `<parameter> = \${1:value},`,
    PARAMETER = `\t<parameter> = <value>,\n`,
}