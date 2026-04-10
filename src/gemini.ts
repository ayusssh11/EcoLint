import { GoogleGenerativeAI } from '@google/generative-ai';
import * as vscode from 'vscode';

export async function optimizeCode(badCode: string): Promise<string | null> {
	const config = vscode.workspace.getConfiguration('ecolint');
	const apiKey = config.get<string>('geminiApiKey');
	const savedModelId = config.get<string>('modelId') || 'gemini-1.5-flash';

	if (!apiKey) {
		vscode.window.showErrorMessage('EcoLint: Gemini API Key is missing. Please set it in settings.');
		return null;
	}

	const genAI = new GoogleGenerativeAI(apiKey);
    // Explicitly use models/ prefix if the alias fails, or just use the saved ID
	const model = genAI.getGenerativeModel({ model: savedModelId });

	const prompt = `
You are an energy-efficiency expert. Refactor the following code block to be more energy-efficient while maintaining the same functionality.

Focus on:
1. Reducing CPU wakeups: Increase timer intervals (>= 100ms) or use requestAnimationFrame.
2. Improving loop efficiency: Move expensive operations (like DOM queries or large allocations) out of loops.
3. Avoiding blocking calls: Suggest asynchronous equivalents for synchronous I/O.
4. Optimizing DOM access: Cache references to external elements rather than re-querying.

Rules:
1. Return ONLY the raw refactored code.
2. No markdown formatting (no triple backticks).
3. No conversational text.
4. Ensure the optimized code is syntactically correct and functional.

Code:
${badCode}
`;

	try {
		const result = await model.generateContent(prompt);
		const response = await result.response;
		return response.text().trim();
	} catch (error: any) {
		console.error('[EcoLint] Gemini API error:', error);
		vscode.window.showErrorMessage(`EcoLint: Gemini API Error - ${error.message || 'Unknown error'}`);
		return null;
	}
}

/**
 * Heuristic ROI check: Energy Saved > AI Query Cost?
 * @param savingPotential Estimated gCO2e saved per hour.
 * @returns boolean
 */
export function checkROI(savingPotential: number): boolean {
    // Placeholder constants
    const GEMINI_CALL_COST_GCO2 = 0.05; // Estimated energy cost of one Gemini 1.5 Flash query
    
	// We assume the refactored code will run for at least 1 hour total in its lifetime.
    return savingPotential > GEMINI_CALL_COST_GCO2;
}

export async function listAvailableModels(): Promise<string[]> {
	const config = vscode.workspace.getConfiguration('ecolint');
	const apiKey = config.get<string>('geminiApiKey');

	if (!apiKey) return [];

	try {
        // We use the REST API directly since it's more reliable for listing than the SDK's abstraction
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
		const data: any = await response.json();
		
		if (data.models) {
			const modelNames = data.models
				.filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
				.map((m: any) => m.name.replace('models/', ''));
            console.log('[EcoLint] Discovered models:', modelNames);
            return modelNames;
		}
		return [];
	} catch (error) {
		console.error('[EcoLint] Error listing models:', error);
		return [];
	}
}
