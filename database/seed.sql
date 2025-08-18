--
-- Seed data generated from current database state
--

--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

INSERT INTO public.templates VALUES (1, 'Task', 'Default template for managing tasks', '2025-07-24T08:49:24.200Z', '2025-07-24T08:49:24.200Z', 'system', 'system');
INSERT INTO public.templates VALUES (2, 'Project', 'Template for project-type parent tasks', '2025-08-04T10:42:31.309Z', '2025-08-04T10:42:31.309Z', 'system', 'system');


--
-- Data for Name: template_properties; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

INSERT INTO public.template_properties VALUES (1, 1, 'Description', 'text', 'Define the core problem and solution in 4 brief sections: **Problem:** Current issue or requirement. **Solution:** What needs to be built/changed. **Success Criteria:** 2-3 measurable completion outcomes. **Impact:** User/business benefit. Keep each section to 1-2 sentences.', '[]', 2, false, 'system', 'claude-desktop', '2025-07-24T08:49:24.202Z', '2025-08-14T13:24:54.282Z');
INSERT INTO public.template_properties VALUES (2, 1, 'Notes', 'text', 'Document only non-obvious implementation details: **Technical Specs:** Specific performance/compatibility requirements if any. **Constraints:** Notable restrictions or limitations. **External Dependencies:** Third-party services/APIs if required. **Risk Factors:** Critical failure points if any. **Special Requirements:** Unique testing/deployment needs if applicable. Omit standard/obvious requirements.', '[]', 5, false, 'system', 'claude-desktop', '2025-07-24T08:49:24.202Z', '2025-08-14T13:25:17.458Z');
INSERT INTO public.template_properties VALUES (3, 1, 'Items', 'text', 'Generate a markdown checklist of implementation steps in logical execution order. Use format: `- [ ] [Specific Action]`, THINK ULTRA HARD ON THIS! Include only necessary steps: environment setup, dependency installation, file creation/modification, configuration changes, database updates, testing (unit, integration, manual), code documentation, README updates. Only include cleanup steps if temporary files/artifacts were created during implementation that become redundant afterward. No section headers - just sequential checklist items in proper execution order.', '[]', 6, false, 'system', 'ui-client', '2025-07-24T08:49:24.202Z', '2025-08-14T13:42:42.666Z');
INSERT INTO public.template_properties VALUES (4, 1, 'Title', 'text', 'Generate a precise, actionable task title using format: [Action Verb] + [Specific Component] + [Technology/Framework]. Use verbs like ''Implement'', ''Fix'', ''Add'', ''Refactor''. Example: ''Implement JWT authentication in Express.js''', '[]', 1, false, 'ui-client', 'claude-desktop', '2025-07-28T09:14:48.845Z', '2025-08-14T13:24:49.333Z');
INSERT INTO public.template_properties VALUES (5, 2, 'Title', 'text', 'Project name and purpose. Be clear and descriptive about the project goals. 2', '[]', 1, true, 'system', 'ui-client', '2025-08-04T10:42:36.845Z', '2025-08-12T09:42:04.395Z');
INSERT INTO public.template_properties VALUES (6, 2, 'Description', 'text', 'What is the core purpose of the application? Describe the main problem it solves or the value it provides in a single, clear statement.', '[]', 2, true, 'system', 'ui-client', '2025-08-04T10:42:40.439Z', '2025-08-07T09:08:06.382Z');
INSERT INTO public.template_properties VALUES (10, 2, 'Personas', 'text', 'Who are the primary users of this application? Provide a few examples of user personas, describing their roles, goals, and pain points.', '[]', 3, false, 'ui-client', 'ui-client', '2025-08-07T09:13:44.643Z', '2025-08-07T09:13:44.643Z');
INSERT INTO public.template_properties VALUES (11, 2, 'Features', 'text', 'Based on the project goal and user personas, list the main functionalities the application must have. These should be high-level features, not implementation details.', '["Description"]', 4, false, 'ui-client', 'ui-client', '2025-08-07T09:13:44.665Z', '2025-08-07T09:13:44.665Z');
INSERT INTO public.template_properties VALUES (12, 2, 'Stack', 'string', 'Given the required features and project scope, what specific technologies should we use? Specify the programming languages, frameworks, and databases for the front-end and back-end.', '["Features"]', 5, false, 'ui-client', 'ui-client', '2025-08-07T09:13:44.680Z', '2025-08-07T09:13:44.680Z');
INSERT INTO public.template_properties VALUES (13, 2, 'Architectural', 'string', 'What is the overall architectural design for this project? Should it be a monolith, a set of microservices, or a serverless application? Describe any specific design patterns or constraints.', '["Stack"]', 6, false, 'ui-client', 'ui-client', '2025-08-07T09:13:44.696Z', '2025-08-07T09:13:44.696Z');
INSERT INTO public.template_properties VALUES (14, 2, 'Structure', 'string', 'Based on the chosen technology stack and architecture, provide a general outline of the project''s file and folder structure. Include the main directories and a brief explanation of their purpose.', '["Architectural"]', 7, false, 'ui-client', 'ui-client', '2025-08-07T09:13:44.710Z', '2025-08-07T09:13:44.710Z');
INSERT INTO public.template_properties VALUES (20, 1, 'Investigation', 'text', 'Analyze existing codebase only if modifying existing project. Document: **Entry Points:** Main files to modify/create. **Dependencies:** Affected existing components. **Configuration:** Required config/environment changes. **Database Impact:** Schema changes if needed. **Integration Points:** How changes connect to existing systems. Skip if building new standalone feature.', '[]', 4, false, 'claude-desktop', 'claude-desktop', '2025-08-14T10:25:15.114Z', '2025-08-14T13:25:09.565Z');
INSERT INTO public.template_properties VALUES (21, 1, 'Research', 'text', 'Research implementation options using available web tools. Provide: **Best Practices:** industry standards found through web search. **Technology Options:** Compare libraries/frameworks with pros/cons based on current documentation. **Recommended Approach:** Select one option with justification based on research findings. **Resources:** Include markdown-formatted links to source documentation used for research (e.g., [Library Name](https://example.com/docs)). Use web search tools to gather current information and skip only if using well-established, obvious solutions.', '[]', 3, false, 'claude-desktop', 'claude-desktop', '2025-08-14T10:31:42.892Z', '2025-08-15T08:53:32.493Z');


--
-- Name: object_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.object_properties_id_seq', 755, true);


--
-- Name: template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.template_properties_id_seq', 21, true);


--
-- Name: objects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.objects_id_seq', 115, true);


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.templates_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--
