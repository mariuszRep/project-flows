--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

INSERT INTO public.templates VALUES (1, 'Task', 'Default template for managing tasks', '2025-07-24 08:49:24.200024+00', '2025-07-24 08:49:24.200024+00', 'system', 'system');
INSERT INTO public.templates VALUES (2, 'Project', 'Template for project-type parent tasks', '2025-08-04 10:42:31.309172+00', '2025-08-04 10:42:31.309172+00', 'system', 'system');


--
-- Data for Name: template_properties; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

INSERT INTO public.template_properties VALUES (2, 1, 'Notes', 'text', 'Comprehensive context including: technical requirements, business constraints, dependencies, acceptance criteria, edge cases, and background information that impacts implementation decisions.', '{}', 3, false, 'system', 'ui-client', '2025-07-24 08:49:24.202802+00', '2025-07-28 14:00:11.818256+00');
INSERT INTO public.template_properties VALUES (3, 1, 'Items', 'text', 'Markdown checklist of specific, actionable, and measurable steps. Each item should be concrete enough that completion can be verified.', '{}', 4, false, 'system', 'ui-client', '2025-07-24 08:49:24.202802+00', '2025-07-28 14:00:11.825921+00');
INSERT INTO public.template_properties VALUES (7, 2, 'Notes', 'text', 'Project-specific context including technical requirements, constraints, dependencies, and background information.', '{}', 3, false, 'system', 'system', '2025-08-04 10:42:44.93479+00', '2025-08-04 10:42:44.93479+00');
INSERT INTO public.template_properties VALUES (8, 2, 'Items', 'text', 'High-level milestones and deliverables for this project organized as a markdown checklist.', '{}', 4, false, 'system', 'system', '2025-08-04 10:42:49.224893+00', '2025-08-04 10:42:49.224893+00');
INSERT INTO public.template_properties VALUES (5, 2, 'Title', 'text', 'Project name and purpose. Be clear and descriptive about the project goals.', '{}', 1, true, 'system', 'ui-client', '2025-08-04 10:42:36.845439+00', '2025-08-04 12:37:54.216034+00');
INSERT INTO public.template_properties VALUES (4, 1, 'Title', 'text', 'Clear, specific, and actionable task title. Use action verbs and be precise about what needs to be accomplished. Examples: ''Implement user login with OAuth'', ''Fix database connection timeout issue'', ''Design API endpoints for user management''', '{}', 1, false, 'ui-client', 'ui-client', '2025-07-28 09:14:48.84509+00', '2025-08-04 13:38:19.572016+00');
INSERT INTO public.template_properties VALUES (1, 1, 'Description', 'text', 'Description of the original request or problem statement. Include the ''what'' and ''why'' - what needs to be accomplished and why it''s important.', '{}', 2, false, 'system', 'ui-client', '2025-07-24 08:49:24.202802+00', '2025-08-04 13:38:19.584142+00');
INSERT INTO public.template_properties VALUES (6, 2, 'Description', 'text', 'What is the core purpose of the application? Describe the main problem it solves or the value it provides in a single, clear statement.', '{}', 2, true, 'system', 'ui-client', '2025-08-04 10:42:40.43934+00', '2025-08-07 09:08:06.382721+00');
INSERT INTO public.template_properties VALUES (10, 2, 'Personas', 'text', 'Who are the primary users of this application? Provide a few examples of user personas, describing their roles, goals, and pain points.', '{}', 3, false, 'ui-client', 'ui-client', '2025-08-07 09:13:44.643472+00', '2025-08-07 09:13:44.643472+00');
INSERT INTO public.template_properties VALUES (11, 2, 'Features', 'text', 'Based on the project goal and user personas, list the main functionalities the application must have. These should be high-level features, not implementation details.', '{Description}', 4, false, 'ui-client', 'ui-client', '2025-08-07 09:13:44.665524+00', '2025-08-07 09:13:44.665524+00');
INSERT INTO public.template_properties VALUES (12, 2, 'Stack', 'string', 'Given the required features and project scope, what specific technologies should we use? Specify the programming languages, frameworks, and databases for the front-end and back-end.', '{Features}', 5, false, 'ui-client', 'ui-client', '2025-08-07 09:13:44.680393+00', '2025-08-07 09:13:44.680393+00');
INSERT INTO public.template_properties VALUES (13, 2, 'Architectural', 'string', 'What is the overall architectural design for this project? Should it be a monolith, a set of microservices, or a serverless application? Describe any specific design patterns or constraints.', '{Stack}', 6, false, 'ui-client', 'ui-client', '2025-08-07 09:13:44.696863+00', '2025-08-07 09:13:44.696863+00');
INSERT INTO public.template_properties VALUES (14, 2, 'Structure', 'string', 'Based on the chosen technology stack and architecture, provide a general outline of the project''s file and folder structure. Include the main directories and a brief explanation of their purpose.', '{Architectural}', 7, false, 'ui-client', 'ui-client', '2025-08-07 09:13:44.710958+00', '2025-08-07 09:13:44.710958+00');


--
-- Name: object_template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.object_template_properties_id_seq', 431, true);


--
-- Name: template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.template_properties_id_seq', 14, true);


--
-- Name: objects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.objects_id_seq', 81, true);


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.templates_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--