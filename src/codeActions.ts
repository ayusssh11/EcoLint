import * as vscode from 'vscode';

export class EcoLintCodeActionProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken
	): vscode.CodeAction[] {
		// Only provide actions for EcoLint diagnostics
		return context.diagnostics
			.filter(diagnostic => diagnostic.source === 'EcoLint')
			.map(diagnostic => this.createFix(document, diagnostic));
	}

	private createFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
		const fix = new vscode.CodeAction('Optimize with EcoLint AI', vscode.CodeActionKind.QuickFix);
		fix.command = {
			command: 'ecolint.optimize',
			title: 'Optimize with Gemini',
			arguments: [document, diagnostic.range]
		};
		fix.diagnostics = [diagnostic];
		fix.isPreferred = true;
		return fix;
	}
}
