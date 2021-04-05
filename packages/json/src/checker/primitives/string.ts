import { ErrorSeverity } from '@spyglassmc/core'
import { arrayToMessage, localize } from '@spyglassmc/locales'
import { Categories } from '../../binder'
import type { JsonNode } from '../../node'
import { JsonStringNode } from '../../node'
import type { JsonChecker, JsonCheckerContext } from '../JsonChecker'

export async function string(node: JsonNode, ctx: JsonCheckerContext) {
	node.expectation = [{ type: 'json:string', typedoc: 'String' }]
	if(!JsonStringNode.is(node)) {
		ctx.err.report(localize('expected', [localize('string')]), node)
	}
}

export function resource(id: string | string[], allowTag = false): JsonChecker {
	return async (node: JsonNode, ctx: JsonCheckerContext) => {
		node.expectation = [{ type: 'json:string', typedoc: typedoc(id), pool: id, resource: true }]

		if(!JsonStringNode.is(node)) {
			ctx.err.report(localize('expected', [localize('string')]), node)
		} else if (typeof id === 'string') {
			if (Categories.has(id)) {
				reference(node, ctx, id)
			} else {
				const normalized = node.value.replace(/^minecraft:/, '')
				const doc = localize(`json.doc.${id}.${normalized}`)
				node.hover = `\`\`\`typescript\n(${id}) ${normalized}\n\`\`\`${doc ? `\n******\n${doc}` : ''}`
			}
		} else if(!id.includes(node.value.replace(/^minecraft:/, '')) && !id.includes(node.value)) {
			ctx.err.report(localize('expected', [arrayToMessage(id, true, 'or')]), node)
		}
	}
}

export function literal(value: string | string[]): JsonChecker {
	return async (node: JsonNode, ctx: JsonCheckerContext) => {
		node.expectation = [{ type: 'json:string', typedoc: typedoc(value), pool: value }]

		if(!JsonStringNode.is(node)) {
			ctx.err.report(localize('expected', [localize('string')]), node)
		} else if (typeof value === 'string') {
			reference(node, ctx, value)
		} else if(!value.includes(node.value)) {
			ctx.err.report(localize('expected', [arrayToMessage(value, true, 'or')]), node)
		}
	}
}

function typedoc(id: string | string[]) {
	return typeof id === 'string'
		? `String("${id}")`
		:	id.length <= 10
			? id.map(e => `"${e}"`).join(' | ')
			: 'String'
}

function reference(node: JsonStringNode, ctx: JsonCheckerContext, id: string) {
	ctx.symbols.query(ctx.doc, id, node.value)
		.ifUnknown(() => {
			ctx.err.report(localize('json.checker.string.undeclared', [id[0].toUpperCase() + id.slice(1), localize('punc.quote', [node.value])]), node, ErrorSeverity.Warning)
		})
		.elseEnter({
			usage: 'reference',
			node,
		})
}
