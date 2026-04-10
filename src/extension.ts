import * as vscode from 'vscode';
import debounce from 'lodash.debounce';
import { detectEnergySmells } from './detector';
import { CarbonIntensity } from './carbon';
import { EcoLintCodeActionProvider } from './codeActions';
import { optimizeCode, listAvailableModels } from './gemini';

let treesSavedItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	console.log('EcoLint is now active!');

	const diagnosticCollection = vscode.languages.createDiagnosticCollection('ecolint');
	context.subscriptions.push(diagnosticCollection);

	const carbonCalculator = new CarbonIntensity();
	const supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];

	// Initialize "Trees Saved" counter
	let savedImpact = context.globalState.get<number>('savedImpact', 0);
	treesSavedItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	treesSavedItem.tooltip = 'Total carbon footprint reduction via EcoLint';
	updateTreesBar(savedImpact, carbonCalculator);
	treesSavedItem.show();
	context.subscriptions.push(treesSavedItem);

	// Debounced trigger for analysis
	const triggerAnalysis = (document: vscode.TextDocument) => {
		if (!supportedLanguages.includes(document.languageId)) {
			return;
		}

		const text = document.getText();
		const smells = detectEnergySmells(text);
		
		const diagnostics: vscode.Diagnostic[] = smells.map(smell => {
			const emissions = carbonCalculator.calculateIntensity(smell.intensity);
			const range = new vscode.Range(
				smell.startLine, smell.startCol,
				smell.endLine, smell.endCol
			);
			
			const diagnostic = new vscode.Diagnostic(
				range,
				`${smell.message}\nEstimated Footprint: ${emissions} gCO2e/hr.\n${smell.description}`,
				vscode.DiagnosticSeverity.Warning
			);
			diagnostic.source = 'EcoLint';
			diagnostic.code = 'energy-smell';
			// Attach intensity for ROI check if needed
			(diagnostic as any).intensity = smell.intensity;
			return diagnostic;
		});

		diagnosticCollection.set(document.uri, diagnostics);
	};

	const debouncedAnalysis = debounce(triggerAnalysis, 500);

	// Event listeners
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			debouncedAnalysis(event.document);
		})
	);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				triggerAnalysis(editor.document);
			}
		})
	);

	// Register Code Actions Provider
	supportedLanguages.forEach(lang => {
		context.subscriptions.push(
			vscode.languages.registerCodeActionsProvider(
				{ scheme: 'file', language: lang },
				new EcoLintCodeActionProvider(),
				{ providedCodeActionKinds: EcoLintCodeActionProvider.providedCodeActionKinds }
			)
		);
	});

	// Optimization Command
	const optimizeCommand = vscode.commands.registerCommand('ecolint.optimize', async (document: vscode.TextDocument, range: vscode.Range) => {
		const badCode = document.getText(range);
		
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "EcoLint: Refining code with Gemini...",
			cancellable: false
		}, async () => {
			const optimized = await optimizeCode(badCode);
			if (optimized) {
				const edit = new vscode.WorkspaceEdit();
				edit.replace(document.uri, range, optimized);
				await vscode.workspace.applyEdit(edit);
				
				// Calculate and update impact
				// Heuristic: assume 1 hour of runtime saved per optimization for MVP
				const intensity = 0.5; // default scale
				const gSaved = parseFloat(carbonCalculator.calculateIntensity(intensity));
				savedImpact += gSaved;
				context.globalState.update('savedImpact', savedImpact);
				updateTreesBar(savedImpact, carbonCalculator);

				vscode.window.showInformationMessage('🌳 Code optimized! Your contribution to a greener web has been recorded.');
			}
		});
	});

	context.subscriptions.push(optimizeCommand);

	// Initial run
	if (vscode.window.activeTextEditor) {
		triggerAnalysis(vscode.window.activeTextEditor.document);
	}

	// Hello World command
	const helloWorldCommand = vscode.commands.registerCommand('ecolint.helloWorld', () => {
		vscode.window.showInformationMessage('EcoLint: Active and scanning for "Energy Smells".');
	});

	context.subscriptions.push(helloWorldCommand);

	// Discovery Command
	const listModelsCommand = vscode.commands.registerCommand('ecolint.listModels', async () => {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "EcoLint: Listing available Gemini models...",
			cancellable: false
		}, async () => {
			const models = await listAvailableModels();
			if (models.length > 0) {
				const choice = await vscode.window.showQuickPick(models, {
					placeHolder: 'Select a model to use for EcoLint'
				});
				if (choice) {
					const config = vscode.workspace.getConfiguration('ecolint');
					await config.update('modelId', choice, vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage(`EcoLint: Now using ${choice}`);
				}
			} else {
				vscode.window.showErrorMessage('EcoLint: Could not retrieve model list. Check your API key.');
			}
		});
	});

	context.subscriptions.push(listModelsCommand);
}

function updateTreesBar(totalGrams: number, calc: CarbonIntensity) {
	const trees = calc.calculateTreesSaved(totalGrams).toFixed(2);
	treesSavedItem.text = `$(tree) Trees Saved: ${trees}`;
}

export function deactivate() {}
