import { Position } from 'vscode-languageserver/node'
import { plugins } from '../..'
import { CommandParser } from '../../parsers/CommandParser'
import { CommandComponentData, MacroData, ParsingContext, ParsingError } from '../../types'
import { StringReader } from '../../utils/StringReader'

export class McfunctionPlugin implements plugins.Plugin {
    [plugins.PluginID] = 'spgoding:mcfunction'

    contributeLanguages(contributor: plugins.Contributor<plugins.LanguageDefinition>) {
        contributor.add('mcfunction', { extensions: ['.mcfunction'] })
    }

    contributeSyntaxComponentParsers(contributor: plugins.Contributor<plugins.SyntaxComponentParser>) {
        contributor.add('spgoding:mcfunction/macro', new MacroSyntaxComponentParser())
        contributor.add('spgoding:mcfunction/command', new CommandSyntaxComponentParser())
    }

    configureLanguages(factory: plugins.LanguageConfigBuilderFactory) {
        factory
            .configure('mcfunction')
            .syntaxComponent('spgoding:mcfunction/macro')
            .syntaxComponent('spgoding:mcfunction/command')
    }
}

export class CommandSyntaxComponentParser implements plugins.SyntaxComponentParser<CommandComponentData> {
    identity = 'spgoding:mcfunction/command'

    test(reader: StringReader, ctx: ParsingContext): [boolean, number] {
        return [reader.peek() !== '$', 0]
    }

    parse(reader: StringReader, ctx: ParsingContext): plugins.SyntaxComponent<CommandComponentData> {
        const start = reader.cursor
        const end = ctx.textDoc.offsetAt(Position.create(ctx.textDoc.positionAt(start).line, Infinity))
        const commandReader = new StringReader(reader.string, start, end)
        commandReader.skipSpace()
        while (true) {
            const lastChar = commandReader.string.charAt(commandReader.end - 1)
            if (StringReader.isLineSeparator(lastChar) && commandReader.end > start) {
                commandReader.end--
            } else {
                break
            }
        }

        const parser = new CommandParser()
        const { data } = parser.parse(commandReader, ctx)
        reader.cursor = commandReader.cursor
        return data
    }
}

export class MacroSyntaxComponentParser implements plugins.SyntaxComponentParser<MacroData> {
    identity = 'spgoding:mcfunction/macro'

    test(reader: StringReader, ctx: ParsingContext): [boolean, number] {
        return [reader.peek() === '$', 0]
    }

    parse(reader: StringReader, ctx: ParsingContext): plugins.SyntaxComponent<MacroData> {
        const ans = plugins.SyntaxComponent.create<MacroData>(this.identity, MacroData.unfinished())
        ans.range.start = reader.cursor
        
        const currentLine = ctx.textDoc.positionAt(reader.cursor).line

        try {
            reader
                .expect('$')
                .skip()

            while (reader.canRead() && ctx.textDoc.positionAt(reader.cursor).line == currentLine) {
                const char = reader.read()

                if (char == '$') {
                    if (reader.peek() == '(') {
                        reader.cursor--
                        this.parseMacroVariable(ans, reader, ctx)
                    }
                }
            }

            ans.range.end = reader.cursor
        }
        catch (p) {
            ans.errors.push(p)
        }

        ans.data.template = reader.string.substring(ans.range.start, ans.range.end)

        return ans
    }

    parseMacroVariable(ans: plugins.SyntaxComponent<MacroData>, reader: StringReader, ctx: ParsingContext): void {
        try {
            reader
                .expect('$')
                .skip()
                .expect('(')
                .skip()

            const start = reader.cursor
            let end = reader.cursor

            while (reader.canRead() && reader.peek() != ')') {
                const char = reader.peek()

                if (char.match(/[a-zA-Z0-9_]/i)) {
                    reader.skip()
                    end = reader.cursor
                } else {
                    ans.errors.push(new ParsingError(
                        { start, end },
                        'Invalid macro variable name',
                        false
                    ))

                    break
                }
            }

            reader
                .expect(')')
                .skip()

            ans.data.placeholders.add(reader.string.substring(start, end))
        }
        catch (p) {
            ans.errors.push(p)
        }
    }
}
