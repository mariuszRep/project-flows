// examples/usage-examples.ts
import MarkdownScriptGenerator from './index.js';

/**
 * Example usage of the MCP Markdown Script Generator
 */
class ExampleUsage {
  private generator: MarkdownScriptGenerator;

  constructor() {
    this.generator = new MarkdownScriptGenerator();
  }

  /**
   * Web Application Development Plan Template
   */
  async generateWebAppPlan() {
    console.log('=== Web Application Development Plan ===\n');

    const webAppScript = {
      title: "Web Application Development Guide",
      stage: "Draft",
      blocks: [
        {
          "Introduction": "Introduce the application, its purpose, and benefits for users"
        },
        {
          "Requirements": "List functional and technical requirements for the application"
        },
        {
          "breakdown": "Tell me a joke"
        }
      ]
    };

    try {
      const result = await this.generator['generateMarkdownScript']({ 
        script: webAppScript as any,
        headerLevel: 1 
      });
      console.log(result.content[0].text);
    } catch (error) {
      console.error('Error generating web app plan:', error);
    }
  }

  /**
   * Test with generate_plan_from_prompt
   */
  async testPromptGeneration() {
    console.log('\n=== Testing generate_plan_from_prompt ===\n');

    try {
      const result = await this.generator['generatePlanFromPrompt']({ 
        prompt: "create plan to develop web app todo list"
      });
      console.log(result.content[0].text);
    } catch (error) {
      console.error('Error generating from prompt:', error);
    }
  }

  /**
   * Run examples
   */
  async runExamples() {
    console.log('🚀 MCP Markdown Script Generator - Web App Development\n');
    console.log('=' .repeat(60));

    await this.generateWebAppPlan();
    await this.testPromptGeneration();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Examples completed successfully!');
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const examples = new ExampleUsage();
  examples.runExamples().catch(console.error);
}

export default ExampleUsage;