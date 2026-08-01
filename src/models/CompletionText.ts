export enum CompletionText {
    BLOCK = `<scriptBlock> <id>{\n`,
    END = '}',
    ID = `\${<completionLevel>:id} `, // extra space so in BLOCK, <id> is followed by a space when ID is present

    PARAMETER_AUTO = `<parameter> = \${<completionLevel>:value},`,
    PARAMETER = `<tabs><parameter> = \${<completionLevel>:<value>},`,
}