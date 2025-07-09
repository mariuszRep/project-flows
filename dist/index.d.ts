declare class MarkdownScriptGenerator {
    private server;
    constructor();
    private setupToolHandlers;
    private generateMarkdownScript;
    private generatePlanFromPrompt;
    private createTemplateFromPrompt;
    private createDefaultScript;
    run(): Promise<void>;
}
export declare class MarkdownScriptTester {
    static testGeneration(): Promise<void>;
}
export default MarkdownScriptGenerator;
//# sourceMappingURL=index.d.ts.map