import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode, } from '@modelcontextprotocol/sdk/types.js';
class MarkdownScriptGenerator {
    server;
    constructor() {
        this.server = new Server({
            name: 'markdown-script-generator',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'generate_markdown_script',
                        description: 'Generate a markdown script based on the provided structure with title, stage, and blocks',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                script: {
                                    type: 'object',
                                    properties: {
                                        title: {
                                            type: 'string',
                                            description: 'The title of the markdown script',
                                        },
                                        stage: {
                                            type: 'string',
                                            description: 'The current stage (e.g., Draft, Review, Final)',
                                        },
                                        blocks: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                additionalProperties: {
                                                    type: 'string',
                                                },
                                            },
                                            description: 'Array of blocks containing section headers and content instructions',
                                        },
                                    },
                                    required: ['title', 'stage', 'blocks'],
                                },
                                headerLevel: {
                                    type: 'number',
                                    description: 'Starting header level (default: 1)',
                                    default: 1,
                                },
                            },
                            required: ['script'],
                        },
                    },
                    {
                        name: 'create_default_script',
                        description: 'Create a default markdown script template with common sections',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                title: {
                                    type: 'string',
                                    description: 'Custom title for the script',
                                    default: 'Generated Script',
                                },
                                includeOptionalSections: {
                                    type: 'boolean',
                                    description: 'Include optional sections like References and Conclusion',
                                    default: false,
                                },
                            },
                        },
                    },
                    {
                        name: 'generate_plan_from_prompt',
                        description: 'Generate a complete markdown plan from a natural language prompt',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                prompt: {
                                    type: 'string',
                                    description: 'Natural language prompt describing what to create a plan for',
                                },
                                headerLevel: {
                                    type: 'number',
                                    description: 'Starting header level (default: 1)',
                                    default: 1,
                                },
                            },
                            required: ['prompt'],
                        },
                    },
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'generate_markdown_script':
                        return await this.generateMarkdownScript(args);
                    case 'create_default_script':
                        return await this.createDefaultScript(args);
                    case 'generate_plan_from_prompt':
                        return await this.generatePlanFromPrompt(args);
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                throw new McpError(ErrorCode.InternalError, `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    async generateMarkdownScript(args) {
        const { script, headerLevel = 1 } = args;
        if (!script || !script.title || !script.stage || !script.blocks) {
            throw new Error('Invalid script structure. Required: title, stage, and blocks');
        }
        let markdown = '';
        // Add title and metadata
        markdown += `${'#'.repeat(headerLevel)} ${script.title}\n\n`;
        markdown += `**Stage:** ${script.stage}\n\n`;
        markdown += `---\n\n`;
        // Process each block
        for (const block of script.blocks) {
            for (const [sectionName, instruction] of Object.entries(block)) {
                // Create section header
                markdown += `${'#'.repeat(headerLevel + 1)} ${sectionName}\n\n`;
                // Generate actual content based on the instruction
                const content = this.generateContentFromInstruction(sectionName, instruction, script.title);
                markdown += `${content}\n\n`;
                markdown += `---\n\n`;
            }
        }
        return {
            content: [
                {
                    type: 'text',
                    text: markdown,
                },
            ],
        };
    }
    async generatePlanFromPrompt(args) {
        const { prompt, headerLevel = 1 } = args;
        if (!prompt || !prompt.trim()) {
            throw new Error('Prompt is required');
        }
        // Create a template based on the prompt
        const template = this.createTemplateFromPrompt(prompt);
        // Use the existing generateMarkdownScript method
        return await this.generateMarkdownScript({
            script: template,
            headerLevel
        });
    }
    generateContentFromInstruction(sectionName, instruction, appTitle) {
        const appType = appTitle.toLowerCase();
        switch (sectionName) {
            case 'Introduction':
                if (appType.includes('todo')) {
                    return `A Todo web application is a digital task management tool designed to help users organize, track, and complete their daily activities efficiently. This application provides a centralized platform where users can create, manage, and prioritize their tasks with ease.\n\n**Key Features:**\n- Create and manage tasks with titles, descriptions, and due dates\n- Mark tasks as complete or incomplete\n- Filter and search through tasks\n- User authentication and personalized task lists\n- Responsive design for desktop and mobile devices\n- Real-time updates and data persistence\n\n**Benefits for Users:**\n- Increased productivity through better task organization\n- Never miss important deadlines with due date tracking\n- Access tasks from anywhere with cloud synchronization\n- Intuitive interface that's easy to learn and use\n- Secure personal data with user authentication`;
                }
                return `This web application serves as a comprehensive solution for task management. It provides users with an intuitive interface to manage their daily activities while ensuring reliable performance and security.`;
            case 'Requirements':
                if (appType.includes('todo')) {
                    return `### Functional Requirements\n\n**User Management:**\n- User registration and authentication\n- Secure login/logout functionality\n- Password reset capabilities\n- User profile management\n\n**Task Management:**\n- Create new tasks with title, description, and due date\n- Edit existing tasks\n- Delete tasks\n- Mark tasks as complete/incomplete\n- Set task priorities (high, medium, low)\n- Add tags or categories to tasks\n\n**User Interface:**\n- Clean, intuitive dashboard\n- Task filtering (by status, priority, date)\n- Search functionality\n- Responsive design for all devices\n- Dark/light theme options\n\n### Technical Requirements\n\n**Performance:**\n- Page load time under 3 seconds\n- Real-time updates without page refresh\n- Support for 1000+ concurrent users\n\n**Security:**\n- HTTPS encryption\n- Input validation and sanitization\n- Protection against common vulnerabilities (XSS, CSRF)\n- Secure password storage with hashing\n\n**Compatibility:**\n- Modern web browsers (Chrome, Firefox, Safari, Edge)\n- Mobile responsive design\n- Offline capabilities with service workers`;
                }
                return `### Functional Requirements\n- Core application features\n- User interaction flows\n- Data management needs\n\n### Technical Requirements\n- Performance specifications\n- Security considerations\n- Scalability requirements`;
            case 'Technology Stack':
                if (appType.includes('todo')) {
                    return `### Frontend Technologies\n\n**React.js** - Component-based UI library\n- **Version**: 18.x\n- **Reason**: Excellent for building interactive UIs with reusable components\n- **Key Features**: Virtual DOM, component lifecycle, hooks\n\n**TypeScript** - Static type checking\n- **Version**: 5.x\n- **Reason**: Improved code quality and developer experience\n- **Benefits**: Better IDE support, catch errors at compile time\n\n**Tailwind CSS** - Utility-first CSS framework\n- **Version**: 3.x\n- **Reason**: Rapid UI development with consistent design\n- **Features**: Responsive design, dark mode support\n\n### Backend Technologies\n\n**Node.js** - JavaScript runtime\n- **Version**: 18.x LTS\n- **Reason**: Full-stack JavaScript development\n- **Benefits**: Fast execution, large ecosystem\n\n**Express.js** - Web application framework\n- **Version**: 4.x\n- **Reason**: Minimal and flexible web framework\n- **Features**: Middleware support, routing, REST API\n\n**MongoDB** - NoSQL database\n- **Version**: 6.x\n- **Reason**: Flexible schema for task data\n- **Features**: Document-based storage, indexing, aggregation\n\n### Development Tools\n\n**Git** - Version control\n**npm** - Package management\n**Jest** - Testing framework\n**ESLint** - Code linting\n**Prettier** - Code formatting`;
                }
                return `### Frontend\n- Modern JavaScript framework\n- CSS framework for styling\n- State management solution\n\n### Backend\n- Server-side runtime\n- Web framework\n- Database solution\n\n### Development Tools\n- Version control\n- Testing framework\n- Build tools`;
            case 'Architecture':
                if (appType.includes('todo')) {
                    return `### System Architecture\n\n**Client-Server Architecture**\n- **Frontend**: React SPA (Single Page Application)\n- **Backend**: RESTful API with Express.js\n- **Database**: MongoDB for data persistence\n- **Communication**: HTTP/HTTPS with JSON payload\n\n**Component Structure**\n\n**Frontend Components:**\n\`\`\`\nsrc/\n├── components/\n│   ├── Auth/\n│   │   ├── Login.tsx\n│   │   └── Register.tsx\n│   ├── Tasks/\n│   │   ├── TaskList.tsx\n│   │   ├── TaskItem.tsx\n│   │   └── TaskForm.tsx\n│   └── Layout/\n│       ├── Header.tsx\n│       └── Navigation.tsx\n├── hooks/\n│   ├── useAuth.ts\n│   └── useTasks.ts\n└── services/\n    └── api.ts\n\`\`\`\n\n**Backend Structure:**\n\`\`\`\nserver/\n├── routes/\n│   ├── auth.js\n│   └── tasks.js\n├── models/\n│   ├── User.js\n│   └── Task.js\n├── middleware/\n│   └── auth.js\n└── server.js\n\`\`\`\n\n**Design Patterns:**\n- **MVC Pattern**: Model-View-Controller separation\n- **Repository Pattern**: Data access abstraction\n- **Middleware Pattern**: Request/response processing\n- **Observer Pattern**: Real-time updates`;
                }
                return `### System Architecture\n- Client-server architecture\n- Component-based design\n- API-first approach\n\n### Design Patterns\n- Model-View-Controller (MVC)\n- Repository pattern\n- Middleware pattern`;
            case 'Implementation Steps':
                if (appType.includes('todo')) {
                    return `### Phase 1: Project Setup (Week 1)\n\n**1. Initialize Project**\n\`\`\`bash\n# Create project directory\nmkdir todo-app\ncd todo-app\n\n# Initialize frontend\nnpx create-react-app frontend --template typescript\ncd frontend\nnpm install axios react-router-dom\n\n# Initialize backend\ncd ..\nmkdir backend\ncd backend\nnpm init -y\nnpm install express mongoose cors dotenv bcryptjs jsonwebtoken\nnpm install -D nodemon\n\`\`\`\n\n**2. Setup Database**\n\`\`\`javascript\n// backend/models/User.js\nconst mongoose = require('mongoose')\n\nconst userSchema = new mongoose.Schema({\n  username: { type: String, required: true, unique: true },\n  email: { type: String, required: true, unique: true },\n  password: { type: String, required: true }\n})\n\nmodule.exports = mongoose.model('User', userSchema)\n\`\`\`\n\n### Phase 2: Authentication (Week 2)\n\n**1. Backend Authentication**\n\`\`\`javascript\n// backend/routes/auth.js\nconst express = require('express')\nconst bcrypt = require('bcryptjs')\nconst jwt = require('jsonwebtoken')\nconst User = require('../models/User')\n\nconst router = express.Router()\n\n// Register\nrouter.post('/register', async (req, res) => {\n  try {\n    const hashedPassword = await bcrypt.hash(req.body.password, 10)\n    const user = new User({\n      ...req.body,\n      password: hashedPassword\n    })\n    await user.save()\n    res.status(201).json({ message: 'User created successfully' })\n  } catch (error) {\n    res.status(400).json({ error: error.message })\n  }\n})\n\nmodule.exports = router\n\`\`\`\n\n### Phase 3: Task Management (Week 3-4)\n\n**1. Task Model and Routes**\n**2. Frontend Task Components**\n**3. CRUD Operations**\n\n### Phase 4: UI/UX Polish (Week 5)\n\n**1. Responsive Design**\n**2. Error Handling**\n**3. Loading States**\n\n### Phase 5: Testing & Deployment (Week 6)\n\n**1. Unit Tests**\n**2. Integration Tests**\n**3. Production Deployment**`;
                }
                return `### Phase 1: Setup\n- Project initialization\n- Environment configuration\n- Basic structure\n\n### Phase 2: Core Development\n- Backend API development\n- Frontend components\n- Database integration\n\n### Phase 3: Testing & Deployment\n- Quality assurance\n- Performance optimization\n- Production deployment`;
            case 'Testing Strategy':
                return `### Testing Approach\n\n**Unit Testing**\n- Test individual components and functions\n- Frontend: Jest + React Testing Library\n- Backend: Jest + Supertest\n- Target: 80%+ code coverage\n\n**Integration Testing**\n- Test API endpoints\n- Database operations\n- Authentication flows\n\n**End-to-End Testing**\n- User journey testing\n- Cross-browser compatibility\n- Mobile responsiveness\n\n**Performance Testing**\n- Load testing with Artillery\n- Bundle size optimization\n- Lighthouse audits`;
            case 'Deployment':
                return `### Deployment Strategy\n\n**Development Environment**\n- Local development with hot reload\n- Environment variables for configuration\n- Docker for containerization\n\n**Production Environment**\n- **Frontend**: Deploy to Vercel/Netlify\n- **Backend**: Deploy to Heroku/Railway\n- **Database**: MongoDB Atlas\n- **CDN**: CloudFlare for static assets\n\n**CI/CD Pipeline**\n- GitHub Actions for automated testing\n- Automated deployment on merge to main\n- Environment-specific configurations\n\n**Security Considerations**\n- SSL certificates\n- Environment variable management\n- CORS configuration\n- Rate limiting`;
            case 'Maintenance':
                return `### Ongoing Maintenance\n\n**Monitoring**\n- Application performance monitoring\n- Error tracking with Sentry\n- User analytics\n- Server health checks\n\n**Updates & Patches**\n- Regular dependency updates\n- Security patches\n- Feature enhancements\n- Bug fixes\n\n**Backup & Recovery**\n- Automated database backups\n- Disaster recovery plan\n- Data retention policies\n\n**Performance Optimization**\n- Code splitting\n- Caching strategies\n- Database query optimization\n- CDN usage`;
            default:
                return `Content for ${sectionName} section would be generated here based on the instruction: ${instruction}`;
        }
    }
    createTemplateFromPrompt(prompt) {
        // Extract key information from prompt
        const promptLower = prompt.toLowerCase();
        // Determine title based on prompt content
        let title = 'Web Application Development Plan';
        if (promptLower.includes('todo') || promptLower.includes('task')) {
            title = 'Todo Web Application Development Plan';
        }
        else if (promptLower.includes('chat') || promptLower.includes('messaging')) {
            title = 'Chat Application Development Plan';
        }
        else if (promptLower.includes('blog') || promptLower.includes('cms')) {
            title = 'Blog/CMS Application Development Plan';
        }
        else if (promptLower.includes('ecommerce') || promptLower.includes('shop')) {
            title = 'E-commerce Application Development Plan';
        }
        // Return template with instruction blocks
        return {
            title,
            stage: 'Draft',
            blocks: [
                {
                    'Introduction': 'Introduce the application, its purpose, and benefits for users'
                },
                {
                    'Requirements': 'List functional and technical requirements for the application'
                },
                {
                    'Technology Stack': 'Explain the chosen technologies, frameworks, and tools'
                },
                {
                    'Joke': 'tell me a joke'
                }
            ]
        };
    }
    async createDefaultScript(args) {
        const { title = 'Generated Script', includeOptionalSections = false } = args;
        const defaultScript = {
            title,
            stage: 'Draft',
            blocks: [
                {
                    'Prompt': 'Refine and enhance the original user request to be more specific and actionable',
                },
                {
                    'Notes': 'Analyze the requirements and provide detailed reasoning for the approach',
                },
                {
                    'Items': 'Break down the task into sequential, actionable steps',
                },
            ],
        };
        // Add optional sections if requested
        if (includeOptionalSections) {
            defaultScript.blocks.push({
                'References': 'List relevant sources, documentation, or external resources needed for the task',
            }, {
                'Conclusion': 'Summarize the expected outcome and next steps after task completion',
            });
        }
        return await this.generateMarkdownScript({ script: defaultScript });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Markdown Script Generator MCP server running on stdio');
    }
}
// Example usage and testing
export class MarkdownScriptTester {
    static async testGeneration() {
        const generator = new MarkdownScriptGenerator();
        // Test with custom script
        const customScript = {
            title: 'API Integration Task',
            stage: 'Planning',
            blocks: [
                {
                    'Prompt': 'Create a comprehensive plan for integrating a third-party API into our application',
                },
                {
                    'Analysis': 'Examine the API documentation and identify key endpoints, authentication requirements, and data structures',
                },
                {
                    'Implementation Steps': 'Define the sequential steps needed to implement the API integration with proper error handling',
                },
                {
                    'Testing Strategy': 'Outline the testing approach including unit tests, integration tests, and error scenarios',
                },
            ],
        };
        try {
            const result = await generator['generateMarkdownScript']({ script: customScript });
            console.log('Generated Markdown:');
            console.log(result.content[0].text);
        }
        catch (error) {
            console.error('Error:', error);
        }
    }
}
// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const generator = new MarkdownScriptGenerator();
    generator.run().catch(console.error);
}
export default MarkdownScriptGenerator;
//# sourceMappingURL=index.js.map