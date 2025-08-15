#!/usr/bin/env node

import pg from 'pg';
import { writeFileSync } from 'fs';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks',
});

function escapeSQL(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''");
}

async function generateSeedFromDatabase() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    let seedSQL = '--\n-- Seed data generated from current database state\n--\n\n';

    // Export templates data
    console.log('Exporting templates...');
    const templates = await client.query('SELECT * FROM templates ORDER BY id');
    seedSQL += '--\n-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: mcp_user\n--\n\n';
    templates.rows.forEach(row => {
      seedSQL += `INSERT INTO public.templates VALUES (${row.id}, '${escapeSQL(row.name)}', '${escapeSQL(row.description)}', '${row.created_at.toISOString()}', '${row.updated_at.toISOString()}', '${row.created_by}', '${row.updated_by}');\n`;
    });
    console.log('✅ Templates exported:', templates.rows.length, 'rows');

    // Export template_properties data  
    console.log('\nExporting template_properties...');
    const templateProps = await client.query('SELECT * FROM template_properties ORDER BY id');
    seedSQL += '\n\n--\n-- Data for Name: template_properties; Type: TABLE DATA; Schema: public; Owner: mcp_user\n--\n\n';
    templateProps.rows.forEach(row => {
      const deps = JSON.stringify(row.dependencies);
      seedSQL += `INSERT INTO public.template_properties VALUES (${row.id}, ${row.template_id}, '${row.key}', '${row.type}', '${escapeSQL(row.description)}', '${deps}', ${row.execution_order}, ${row.fixed}, '${row.created_by}', '${row.updated_by}', '${row.created_at.toISOString()}', '${row.updated_at.toISOString()}');\n`;
    });
    console.log('✅ Template properties exported:', templateProps.rows.length, 'rows');

    // Get current sequence values
    console.log('\nGetting sequence values...');
    const sequences = {};
    const seqNames = ['object_properties_id_seq', 'template_properties_id_seq', 'objects_id_seq', 'templates_id_seq'];
    
    for (const seqName of seqNames) {
      try {
        const result = await client.query(`SELECT last_value FROM ${seqName}`);
        sequences[seqName] = result.rows[0].last_value;
      } catch (e) {
        // Use default values if sequence doesn't exist
        const defaults = {
          'object_properties_id_seq': 431,
          'template_properties_id_seq': 14, 
          'objects_id_seq': 115,
          'templates_id_seq': 2
        };
        sequences[seqName] = defaults[seqName];
      }
    }

    // Add sequence updates
    seedSQL += '\n\n--\n-- Name: object_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user\n--\n\n';
    seedSQL += `SELECT pg_catalog.setval('public.object_properties_id_seq', ${sequences['object_properties_id_seq']}, true);\n\n`;
    
    seedSQL += '\n--\n-- Name: template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user\n--\n\n';
    seedSQL += `SELECT pg_catalog.setval('public.template_properties_id_seq', ${sequences['template_properties_id_seq']}, true);\n\n`;
    
    seedSQL += '\n--\n-- Name: objects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user\n--\n\n';
    seedSQL += `SELECT pg_catalog.setval('public.objects_id_seq', ${sequences['objects_id_seq']}, true);\n\n`;
    
    seedSQL += '\n--\n-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user\n--\n\n';
    seedSQL += `SELECT pg_catalog.setval('public.templates_id_seq', ${sequences['templates_id_seq']}, true);\n\n`;

    seedSQL += '\n--\n-- PostgreSQL database dump complete\n--\n';

    // Write to file
    writeFileSync('seed.sql', seedSQL);
    console.log('\n🎉 New seed.sql file generated with current database state!');
    console.log('File written to: seed.sql');

    // Show what was exported
    console.log('\n=== Export Summary ===');
    console.log('✅ Templates:', templates.rows.length, 'rows');
    console.log('✅ Template properties:', templateProps.rows.length, 'rows');
    console.log('✅ Sequence values:');
    Object.entries(sequences).forEach(([name, value]) => {
      console.log(`   - ${name}: ${value}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

generateSeedFromDatabase();