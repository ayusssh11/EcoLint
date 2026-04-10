import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

export interface EnergySmell {
	startLine: number;
	startCol: number;
	endLine: number;
	endCol: number;
	message: string;
	description: string;
	intensity: number; // 0-1 score for intensity calculation
}

export function detectEnergySmells(text: string): EnergySmell[] {
	const smells: EnergySmell[] = [];
	try {
		const ast = parse(text, {
			sourceType: 'module',
			plugins: ['typescript', 'jsx']
		});

		traverse(ast, {
			CallExpression(path) {
				const { callee, arguments: args } = path.node;
				
				// Pattern 1 & 2: setInterval/setTimeout < 100ms
				const isTimer = callee.type === 'Identifier' && (callee.name === 'setInterval' || callee.name === 'setTimeout');
				
				if (isTimer && args.length >= 2) {
					const delayNode = args[1];
					if (delayNode.type === 'NumericLiteral' && delayNode.value < 100) {
						
						// Additional check for recursive setTimeout
						let isRecursive = false;
						if (callee.type === 'Identifier' && callee.name === 'setTimeout') {
							const funcScope = path.scope.getFunctionParent();
							const funcArg = args[0];
							if (funcScope && funcArg.type === 'Identifier' && (funcScope.path.node as any).id?.name === funcArg.name) {
								isRecursive = true;
							}
						}

						if (callee.name === 'setInterval' || isRecursive) {
							smells.push({
								startLine: (path.node.loc?.start.line || 1) - 1,
								startCol: path.node.loc?.start.column || 0,
								endLine: (path.node.loc?.end.line || 1) - 1,
								endCol: path.node.loc?.end.column || 0,
								message: `[EcoLint] High-frequency ${callee.name} detected: ${delayNode.value}ms.`,
								description: `${callee.name === 'setInterval' ? 'Timers' : 'Recursive timeouts'} under 100ms cause excessive CPU wakeups, significantly increasing carbon footprint.`,
								intensity: (100 - delayNode.value) / 100
							});
						}
					}
				}

				// Pattern 3: Synchronous I/O
				const syncMethods = ['readFileSync', 'writeFileSync', 'appendFileSync', 'mkdirSync', 'rmdirSync', 'unlinkSync'];
				let isSyncIO = false;
				let methodName = '';

				if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier' && syncMethods.includes(callee.property.name)) {
					isSyncIO = true;
					methodName = callee.property.name;
				} else if (callee.type === 'Identifier' && syncMethods.includes(callee.name)) {
					isSyncIO = true;
					methodName = callee.name;
				}

				if (isSyncIO) {
					smells.push({
						startLine: (path.node.loc?.start.line || 1) - 1,
						startCol: path.node.loc?.start.column || 0,
						endLine: (path.node.loc?.end.line || 1) - 1,
						endCol: path.node.loc?.end.column || 0,
						message: `[EcoLint] Synchronous I/O detected: ${methodName}.`,
						description: 'Synchronous I/O blocks the event loop, causing CPU idling and inefficient energy usage. Use asynchronous equivalents.',
						intensity: 0.6
					});
				}

				// Pattern 4: DOM Access in Loops
				const domMethods = ['querySelector', 'querySelectorAll', 'getElementById', 'getElementsByClassName', 'getElementsByTagName'];
				let isDomQuery = false;
				if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier' && domMethods.includes(callee.property.name)) {
					isDomQuery = true;
				} else if (callee.type === 'Identifier' && domMethods.includes(callee.name)) {
					isDomQuery = true;
				}

				if (isDomQuery) {
					// Check if inside a loop
					const inLoop = path.findParent((p) => p.isLoop());
					if (inLoop) {
						smells.push({
							startLine: (path.node.loc?.start.line || 1) - 1,
							startCol: path.node.loc?.start.column || 0,
							endLine: (path.node.loc?.end.line || 1) - 1,
							endCol: path.node.loc?.end.column || 0,
							message: `[EcoLint] DOM query inside loop detected.`,
							description: 'Querying the DOM inside a loop causes repeated layout calculations (reflows), draining device power.',
							intensity: 0.8
						});
					}
				}
			}
		});
	} catch (e) {
		// Silent catch for syntax errors while typing
	}
	return smells;
}

