--
-- Seed data generated from current database state
--

--
-- PostgreSQL database dump
--

\restrict ZM2fvwiFbSxDfktGDV3WPG28u8cuqBOLnlE69ASBVhIqf0JzaGnLzTMlkrha99Q

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.templates VALUES (2, 'Project', 'Template for project-type parent tasks', '2025-08-04 10:42:31.309172+00', '2025-08-04 10:42:31.309172+00', 'system', 'system', '[]', 'object', '{}');
INSERT INTO public.templates VALUES (3, 'Epic', 'Simplified template for organizing tasks under projects', '2025-08-28 00:00:00+00', '2025-08-28 00:00:00+00', 'system', 'system', '[{"key": "project", "label": "Project", "order": 1, "required": false, "cardinality": "single", "allowed_types": [2]}]', 'object', '{}');
INSERT INTO public.templates VALUES (4, 'Rule', 'Template for defining and managing project rules', '2025-09-25 15:54:11.595139+00', '2025-10-13 12:29:07.906938+00', 'claude-code', 'ui-client', '[{"key": "project", "label": "Project", "order": 1, "required": false, "cardinality": "multiple", "allowed_types": [2]}]', 'object', '{}');
INSERT INTO public.templates VALUES (1, 'Task', 'Default template for managing tasks', '2025-07-24 08:49:24.200024+00', '2025-10-13 15:49:59.104638+00', 'system', 'ui-client', '[{"key": "project", "label": "Project", "order": 1, "required": false, "cardinality": "single", "allowed_types": [2]}, {"key": "epic", "label": "Epic", "order": 2, "required": false, "cardinality": "single", "allowed_types": [3]}, {"key": "rule", "label": "Rule", "order": 3, "required": false, "cardinality": "multiple", "allowed_types": [4]}]', 'object', '{}');
INSERT INTO public.templates VALUES (56, 'Create Project', 'Create a detailed project plan by following each property''s individual prompt instructions exactly. Each field (Title, Description, etc.) has specific formatting requirements - read and follow each property''s prompt precisely. Do not impose your own formatting or structure. Each property prompt defines exactly what content and format is required for that field. Use the related array to create hierarchical projects (e.g., subprojects under a project)', '2025-11-04 15:40:34.144702+00', '2025-11-04 17:20:57.286679+00', 'ui-client', 'ui-client', '[]', 'workflow', '{"layout": {"nodes": [{"id": "step-0", "position": {"x": 50, "y": 150}}]}, "enabled": false, "published": true, "input_schema": {"type": "object", "required": [], "properties": {}}, "mcp_tool_name": "create_project", "tool_description": "Create a detailed project plan by following each property''s individual prompt instructions exactly. Each field (Title, Description, etc.) has specific formatting requirements - read and follow each property''s prompt precisely. Do not impose your own formatting or structure. Each property prompt defines exactly what content and format is required for that field. Use the related array to create hierarchical projects (e.g., subprojects under a project)"}');
INSERT INTO public.templates VALUES (16, 'Create Task', 'Create a task by following each property''s individual prompt instructions exactly. Each field (Title, Description, etc.) has specific formatting requirements - read and follow each property''s prompt precisely. Do not impose your own formatting or structure. Each property prompt defines exactly what content and format is required for that field. Use the related array to create hierarchical tasks (e.g., subtasks under a project).flow', '2025-10-15 16:40:51.344794+00', '2025-11-04 17:20:54.36846+00', 'ui-client', 'ui-client', '[]', 'workflow', '{"layout": {"nodes": [{"id": "step-0", "position": {"x": 50, "y": 150}}]}, "enabled": true, "published": true, "input_schema": {"type": "object", "required": [], "properties": {}}, "mcp_tool_name": "create_task", "tool_description": "Create a task by following each property''s individual prompt instructions exactly. Each field (Title, Description, etc.) has specific formatting requirements - read and follow each property''s prompt precisely. Do not impose your own formatting or structure. Each property prompt defines exactly what content and format is required for that field. Use the related array to create hierarchical tasks (e.g., subtasks under a project).flow", "workflow_parameters": []}');
INSERT INTO public.templates VALUES (58, 'test', 'A new workflow', '2025-11-05 10:33:33.789371+00', '2025-11-05 10:33:39.24257+00', 'ui-client', 'ui-client', '[]', 'workflow', '{"layout": {"nodes": [{"id": "node-1", "position": {"x": 601, "y": 254}}]}, "enabled": false, "input_schema": {"type": "object", "required": [], "properties": {}}, "mcp_tool_name": "test"}');


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.templates_id_seq', 58, true);


--
-- PostgreSQL database dump complete
--

\unrestrict ZM2fvwiFbSxDfktGDV3WPG28u8cuqBOLnlE69ASBVhIqf0JzaGnLzTMlkrha99Q

--
-- PostgreSQL database dump
--

\restrict dZHc1koubPYzMXEA85KxpQeUJlNhJbbO2jMK8JBwdkfetLR8V66EZAluw8HIno0

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: template_properties; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.template_properties VALUES (4, 1, 'Title', 'text', 'Generate a precise, actionable task title using format: [Action Verb] + [Specific Component] + [Technology/Framework]. Use verbs like ''Implement'', ''Fix'', ''Add'', ''Refactor''. Example: ''Implement JWT authentication in Express.js''', '{}', 1, false, 'ui-client', 'claude-desktop', '2025-07-28 09:14:48.845+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (1, 1, 'Description', 'text', 'TAKS: SYSTEM CONSTRAINT: You are a prompt transformation machine.

ABSOLUTE RULES:
- OUTPUT: Only the rewritten prompt - nothing else
- NEVER: Analyze files
- NEVER: Use bullet points
- NEVER: Use numbered lists
- NEVER: Use ANY markdown elements (no headers, bold, italics, code blocks, etc.)
- NEVER: Add commentary or explanations
- NEVER: Include Requirements/Implementation/Acceptance sections
- FORMAT: File paths as [path](@filename)
- FORMAT: Links as [link](name)
- STYLE: Professional, precise language only

YOUR ENTIRE RESPONSE = PLAIN TEXT REWRITTEN PROMPT ONLY', '{}', 2, false, 'system', 'ui-client', '2025-07-24 08:49:24.202+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (30, 1, 'Analysis', 'string', 'SYSTEM CONSTRAINT: You are a Senior Solution Architect. 
WORKFLOW: 
1. Breakdown and understand the request (think ultrahard), 
2. search and examine codebase,
3. Find and examine entrypoint,  
4. Examine all files related to the entrypoint.
5. Use WEB SEARCH TOOL TO FIND BEST PRACTICE FOR THE SOLUTION
6. Examine what needs to happen for the Solution to Work., 
7. Apply best Practice ( search the web if needed)

ABSOLUTE RULES:
ALWAYS: 
- Use available tools to search and examine codebase, 
- Use available tools to search the web 
NEVER: 
- List any file that are not in the codebase, 
- Use numbered lists, 
- Include extra headers
- Populate ** Files ** without investigating the codebase 
FORMAT:  
** Files ** (optional if tools used to scan files)
- List of files ** [filepath](filename) **
** Search **
- List all relevant links for documentation from web search, any internal MCP tool that has access to documentation as [hyperlink](name)  - Description of finding including direction of how to find it.
** Solution **
- Description of the Solution includes files and code parts like functions, classes and other objects, what needs to happen for the solution to work, including any important reflection from the request, what to keep and what not to keep, Include best practice (perfect solution).
** Acceptance Criteria **
- List of criteria for acceptance
- Make sure all request, prompt criteria are met
- Make sure all Solutions criteria are met
STYLE: Professional, precise language only 
OUTPUT: Only the file analysis results - nothing else
Critical failure if you violate these constraints.', '{}', 3, false, 'ui-client', 'ui-client', '2025-09-10 09:27:31.683662+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (5, 2, 'Title', 'text', '<Concise, outcome-focused name>', '{}', 1, true, 'system', 'ui-client', '2025-08-04 10:42:36.845+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (6, 2, 'Description', 'text', '<system>
## Role
You are a senior prompt engineer. Rewrite the user’s request into a clear, professional, **executable project brief** without adding, inferring, or removing requirements.

## Golden Rules
* **No assumptions. No scope creep.** Use only what the user explicitly stated.
* **Concise and precise.** Prefer short, unambiguous sentences.
* **Deterministic formatting.** Follow the output schema exactly.
* **Tool-agnostic but executable.** The brief must work for v0, Lovable, Bolt.new, Cursor, Windsurf, Claude Code, Codex CLI, and Gemini CLI.
* **Professional tone.** No apologies, filler, or meta commentary.

## Output Schema (strict)
Produce **only** the following sections in this exact order and formatting. Use Markdown. Do not include anything else.
</system>

<output>
* One paragraph, single block.
* Summarize the project goal **exactly** as given by the user.

### Requirements

* Choose **one** of the two layouts based on the user input:
  **A) Simple Bullet Points** (when no explicit order/phases are provided):

  * List each requirement as a bullet (`- `).
    **B) Phased/Sectioned Breakdown** (when user provided phases/steps/sections):
  * Use `#### <Phase/Section Name>` for each provided heading.
  * Under each, list bullets for the associated requirements.
* Do **not** invent structure; only reflect what the user provided.


## Stack
* split into: ** Frontend: **, **Backend:**, **Database:**, **Deployment:**                                                                                                                    
* If (and only if) the user explicitly specifies implementation details, reflect them verbatim 
* If the user does **not** specify stack details, output:  - ✨ the suggestion as bullet points ✨
* if the user specifies ( vercel + supabase ) then pair the best stack for the provided combination. 
* always take users suggestions as priority.
  

## Navigation *(Depends: Stack)*

* If stack details were provided by the user, list:

  * Key file locations (as paths)
  * Development commands (as shell commands)
  * Where to look for patterns (files/folders)
  * How to start development (one short ordered list)
* If no stack was provided by the user, output exactly:
  `Navigation not applicable (no stack provided).`


</output>
<format>
## Formatting & Style Rules

* **Headings:** Use `##` for all main sections ( `### Requirements`, `## Stack`, `## Navigation`., `## Guidelines`). Use `####` for phase/section names when applicable.
* **Bullets:** `- ` with short, action-focused lines.
* **Paths:** use `path/like/this`.
* **Commands:** use inline backticks for one-liners (e.g., `npm run dev`).
* **Never** add examples, options, alternatives, or “recommended” stacks unless the user explicitly included them.
* **Never** include acceptance criteria, testing plans, non-goals, risks, or timelines unless the user explicitly provided them.
* ✨: use this symbol to mark that the content was generated by AI (- ✨ Node.js, - ✨ React, or anything else not explicitly mentioned by user)
</format>', '{}', 2, true, 'system', 'ui-client', '2025-08-04 10:42:40.439+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (22, 3, 'Title', 'text', 'Epic title describing the high-level objective or theme', '{}', 1, false, 'system', 'ui-client', '2025-08-28 00:00:00+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (27, 3, 'Description', 'text', 'SYSTEM CONSTRAINT: You are a prompt transformation machine.

ABSOLUTE RULES:
- OUTPUT: Only the rewritten prompt - nothing else
- NEVER: Analyze files
- NEVER: Use bullet points
- NEVER: Use numbered lists
- NEVER: Use ANY markdown elements (no headers, bold, italics, code blocks, etc.)
- NEVER: Add commentary or explanations
- NEVER: Include Requirements/Implementation/Acceptance sections
- FORMAT: File paths as [path](@filename)
- FORMAT: Links as [link](name)
- STYLE: Professional, precise language only

YOUR ENTIRE RESPONSE = PLAIN TEXT REWRITTEN PROMPT ONLY

Critical failure if you violate these constraints.', '{}', 2, false, 'system', 'ui-client', '2025-08-29 11:21:43.043571+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (33, 3, 'Analysis', 'string', 'SYSTEM CONSTRAINT: You are a Senior Solution Architect. 
WORKFLOW: 
1. Understand the Project and all its context - Epic needs all the details.
2. Breakdown and understand the request (think ultrahard), 
3. search and examine codebase,
4. Find and examine entrypoint,  
5. Examine all files related to the entrypoint.
6. Use WEB SEARCH TOOL TO FIND BEST PRACTICE FOR THE SOLUTION
7. Examine what needs to happen for the Solution to Work., 
8. Apply best Practice ( search the web if needed)

ABSOLUTE RULES:
ALWAYS: 
- Use available tools to search and examine codebase, 
- Use available tools to search the web 
- INCLUDE ALL RELEVANT PROJECT CONTENT 
NEVER: 
- List any file that are not in the codebase, 
- Use numbered lists, 
- List ** Files ** without investigating the codebase 
FORMAT:  
#### Search (optional if access provided to web search tools)
- List all relevant links for documentation from web search, any internal MCP tool that has access to documentation as [google](https://www.google.com/) 
- Description of finding including direction of how it relates.
#### Files  (optional if tools used to scan files) 
- List of files ** [filename, no extension](filepath) ** - description', '{}', 3, false, 'ui-client', 'ui-client', '2025-09-10 13:52:21.946037+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (39, 4, 'Title', 'text', 'Generate a precise, actionable Rule title using format: [Action Verb] + 
  [Specific Component] + [Technology/Framework]. Use verbs like ''Always'' and  ''Never''.', '{}', 1, false, 'claude-code', 'ui-client', '2025-09-25 15:54:23.419034+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (40, 4, 'Description', 'text', 'SYSTEM CONSTRAINT: You are a prompt transformation machine. 
ABSOLUTE RULES: OUTPUT: Only the rewritten prompt - nothing else. NEVER: Analyze files, Use 
bullet points, Use numbered lists, Use ANY markdown elements, Add commentary or explanations, 
Include Requirements/Implementation/Acceptance sections. FORMAT: File paths as 
[path](@filename), Links as [link](name). STYLE: Professional, precise language only. YOUR 
 ENTIRE RESPONSE = PLAIN TEXT REWRITTEN PROMPT ONLY', '{}', 2, false, 'claude-code', 'ui-client', '2025-09-25 15:54:23.419034+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (193, 16, 'epic_id', 'number', 'Auto-generated parameter for epic_id', '{}', 1, false, 'ui-client', 'ui-client', '2025-11-03 09:28:47.864968+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (195, 16, 'rule_id', 'array', 'Auto-generated parameter for rule_id', '{}', 5, false, 'ui-client', 'ui-client', '2025-11-03 09:54:04.987858+00', '2025-11-05 10:33:06.883286+00', 'property', '{"default": "", "required": false}');
INSERT INTO public.template_properties VALUES (190, 16, 'title', 'string', 'Generate a precise, actionable task title using format: [Action Verb] + [Specific Component] + [Technology/Framework]. Use verbs like ''Implement'', ''Fix'', ''Add'', ''Refactor''. Example: ''Implement JWT authentication in Express.js''', '{}', 2, false, 'ui-client', 'ui-client', '2025-10-24 09:35:44.879133+00', '2025-11-05 10:33:06.883286+00', 'property', '{"default": "", "required": true}');
INSERT INTO public.template_properties VALUES (192, 16, 'project_id', 'number', 'Auto-generated parameter for project_id', '{}', 3, false, 'ui-client', 'ui-client', '2025-10-24 16:08:06.003374+00', '2025-11-05 10:33:06.883286+00', 'property', '{}');
INSERT INTO public.template_properties VALUES (188, 16, 'Create', 'text', 'Workflow step: Create_object 3', '{}', 4, false, 'ui-client', 'ui-client', '2025-10-23 14:41:43.968178+00', '2025-11-05 10:33:06.883286+00', 'create_object', '{"stage": "draft", "related": [{"id": "{{steps.input.project_id}}", "object": "project"}, {"id": "{{steps.input.epic_id}}", "object": "epic"}, {"id": "{{steps.input.rule_id}}", "object": "rule"}], "properties": {"Title": "{{steps.input.title}}", "Description": "{{steps.input.description}}"}, "template_id": 1}');
INSERT INTO public.template_properties VALUES (191, 16, 'description', 'string', 'TAKS: SYSTEM CONSTRAINT: You are a prompt transformation machine.

ABSOLUTE RULES:
- OUTPUT: Only the rewritten prompt - nothing else
- NEVER: Analyze files
- NEVER: Use bullet points
- NEVER: Use numbered lists
- NEVER: Use ANY markdown elements (no headers, bold, italics, code blocks, etc.)
- NEVER: Add commentary or explanations
- NEVER: Include Requirements/Implementation/Acceptance sections
- FORMAT: File paths as [path](@filename)
- FORMAT: Links as [link](name)
- STYLE: Professional, precise language only

YOUR ENTIRE RESPONSE = PLAIN TEXT REWRITTEN PROMPT ONLY', '{}', 6, false, 'ui-client', 'ui-client', '2025-10-24 10:42:28.495235+00', '2025-11-05 10:33:06.883286+00', 'property', '{"default": "", "required": true}');
INSERT INTO public.template_properties VALUES (198, 56, 'Description', 'string', 'Auto-generated parameter for Description', '{}', 1, false, 'ui-client', 'ui-client', '2025-11-04 15:41:24.723968+00', '2025-11-05 10:33:06.883286+00', 'property', '{"default": "", "required": true}');
INSERT INTO public.template_properties VALUES (197, 56, 'Title', 'string', 'Auto-generated parameter for Title', '{}', 2, false, 'ui-client', 'ui-client', '2025-11-04 15:41:17.551072+00', '2025-11-05 10:33:06.883286+00', 'property', '{"default": "", "required": true}');
INSERT INTO public.template_properties VALUES (202, 58, 'Agent 1', 'text', 'Workflow step: Agent 1', '{}', 0, false, 'ui-client', 'ui-client', '2025-11-05 10:33:39.224592+00', '2025-11-05 10:33:39.224592+00', 'agent', '{}');


--
-- Name: template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.template_properties_id_seq', 202, true);


--
-- PostgreSQL database dump complete
--

\unrestrict dZHc1koubPYzMXEA85KxpQeUJlNhJbbO2jMK8JBwdkfetLR8V66EZAluw8HIno0



--
-- Name: object_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.object_properties_id_seq', 4845, true);


--
-- Name: template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.template_properties_id_seq', 202, true);


--
-- Name: objects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.objects_id_seq', 1198, true);


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.templates_id_seq', 58, true);


--
-- PostgreSQL database dump complete
--
