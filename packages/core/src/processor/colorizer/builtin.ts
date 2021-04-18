import type { MetaRegistry } from '../..'
import type { AstNode, CommentNode, ErrorNode, FloatBaseNode, FloatNode, IntegerBaseNode, IntegerNode, ResourceLocationNode, StringBaseNode, StringNode } from '../../node'
import type { LiteralBaseNode, LiteralNode } from '../../node/LiteralNode'
import type { SymbolBaseNode, SymbolNode } from '../../node/SymbolNode'
import { IndexMap, Range } from '../../source'
import { traversePreOrder } from '../util'
import type { Colorizer, ColorTokenType } from './Colorizer'
import { ColorToken } from './Colorizer'

/**
 * Use the shallowest children that have their own colorizers to provide the color tokens.
 */
export const fallback: Colorizer<AstNode> = (node, ctx) => {
	const ans: ColorToken[] = []
	traversePreOrder(node,
		node => !ctx.options.range || Range.intersects(node.range, ctx.options.range),
		node => ctx.meta.hasColorizer(node.type),
		node => {
			const colorizer = ctx.meta.getColorizer(node.type)
			const result = colorizer(node, ctx)
			ans.push(...result)
		}
	)
	return Object.freeze(ans)
}

export const comment: Colorizer<CommentNode> = node => {
	return [ColorToken.create(node, 'comment')]
}

export const error: Colorizer<ErrorNode> = node => {
	return [ColorToken.create(node, 'error')]
}

export const literal: Colorizer<LiteralBaseNode> = node => {
	return [ColorToken.create(node, 'literal')]
}

export const number: Colorizer<IntegerBaseNode | FloatBaseNode> = node => {
	return [ColorToken.create(node, 'number')]
}

export const resourceLocation: Colorizer<ResourceLocationNode> = (node, ctx) => {
	let type: ColorTokenType
	switch (node.options.category) {
		case 'function':
		case 'tag/function':
			type = 'function'
			break
		default:
			type = 'resourceLocation'
			break
	}
	return [ColorToken.create(node, type)]
}

export const string: Colorizer<StringBaseNode> = (node, ctx) => {
	if (node.valueNode) {
		const colorizer = ctx.meta.getColorizer(node.valueNode.type)
		const result = colorizer(node.valueNode, ctx)
		// TODO: Fill the gap between the last token and the ending quote with errors.
		return ColorToken.fillGap(toOuterColorTokens(result, node.valueMap), node.range, 'string')
	} else {
		return [ColorToken.create(node, 'string')]
	}
}

export const symbol: Colorizer<SymbolBaseNode> = node => {
	// TODO: Set the modifiers according to `node.symbol`.
	return [ColorToken.create(node, 'variable')]
}

function toOuterColorTokens(tokens: readonly ColorToken[], mapping: IndexMap): ColorToken[] {
	return tokens.map(token => ({
		...token,
		range: IndexMap.toOuterRange(mapping, token.range),
	}))
}

export function registerColorizers(meta: MetaRegistry) {
	meta.registerColorizer<CommentNode>('comment', comment)
	meta.registerColorizer<ErrorNode>('error', error)
	meta.registerColorizer<FloatNode>('float', number)
	meta.registerColorizer<IntegerNode>('integer', number)
	meta.registerColorizer<LiteralNode>('literal', literal)
	meta.registerColorizer<ResourceLocationNode>('resource_location', resourceLocation)
	meta.registerColorizer<StringNode>('string', string)
	meta.registerColorizer<SymbolNode>('symbol', symbol)
}
