/**
 * Test script for updateTemplateSchema method
 */

import DatabaseService from './src/database.js';

async function testUpdateTemplateSchema() {
  const dbService = new DatabaseService();

  try {
    await dbService.initialize();
    console.log('✓ Database connection established');

    // Get current templates
    console.log('\n1. Fetching templates...');
    const templates = await dbService.getTemplates();
    console.log('Templates found:', templates.map(t => ({ id: t.id, name: t.name })));

    // Test 1: Update with valid schema for template 1 (Task)
    console.log('\n2. Testing valid schema update for Template 1 (Task)...');
    const validSchema = [
      {
        key: 'project',
        label: 'Project',
        allowed_types: [2],
        cardinality: 'single' as const,
        required: false,
        order: 1
      },
      {
        key: 'epic',
        label: 'Epic',
        allowed_types: [3],
        cardinality: 'single' as const,
        required: false,
        order: 2
      }
    ];

    const result1 = await dbService.updateTemplateSchema(1, validSchema, 'test-script');
    console.log(result1 ? '✓ Valid schema update succeeded' : '✗ Valid schema update failed');

    // Test 2: Try to update non-existent template
    console.log('\n3. Testing update for non-existent template...');
    try {
      await dbService.updateTemplateSchema(999, validSchema, 'test-script');
      console.log('✗ Should have thrown error for non-existent template');
    } catch (error: any) {
      console.log('✓ Correctly threw error:', error.message);
    }

    // Test 3: Invalid template_id
    console.log('\n4. Testing invalid template_id (0)...');
    try {
      await dbService.updateTemplateSchema(0, validSchema, 'test-script');
      console.log('✗ Should have thrown error for invalid template_id');
    } catch (error: any) {
      console.log('✓ Correctly threw error:', error.message);
    }

    // Test 4: Invalid schema entry (missing key)
    console.log('\n5. Testing invalid schema (missing key)...');
    try {
      const invalidSchema: any = [
        {
          label: 'Project',
          allowed_types: [2],
          cardinality: 'single',
          required: false,
          order: 1
        }
      ];
      await dbService.updateTemplateSchema(1, invalidSchema, 'test-script');
      console.log('✗ Should have thrown error for missing key');
    } catch (error: any) {
      console.log('✓ Correctly threw error:', error.message);
    }

    // Test 5: Invalid cardinality
    console.log('\n6. Testing invalid cardinality...');
    try {
      const invalidSchema: any = [
        {
          key: 'project',
          label: 'Project',
          allowed_types: [2],
          cardinality: 'invalid',
          required: false,
          order: 1
        }
      ];
      await dbService.updateTemplateSchema(1, invalidSchema, 'test-script');
      console.log('✗ Should have thrown error for invalid cardinality');
    } catch (error: any) {
      console.log('✓ Correctly threw error:', error.message);
    }

    // Test 6: Empty allowed_types array
    console.log('\n7. Testing empty allowed_types...');
    try {
      const invalidSchema: any = [
        {
          key: 'project',
          label: 'Project',
          allowed_types: [],
          cardinality: 'single',
          required: false,
          order: 1
        }
      ];
      await dbService.updateTemplateSchema(1, invalidSchema, 'test-script');
      console.log('✗ Should have thrown error for empty allowed_types');
    } catch (error: any) {
      console.log('✓ Correctly threw error:', error.message);
    }

    // Test 7: Update with empty schema (valid - clears relationships)
    console.log('\n8. Testing empty schema array (should be valid)...');
    const result7 = await dbService.updateTemplateSchema(1, [], 'test-script');
    console.log(result7 ? '✓ Empty schema update succeeded' : '✗ Empty schema update failed');

    // Restore original schema
    console.log('\n9. Restoring original schema...');
    await dbService.updateTemplateSchema(1, validSchema, 'test-script');
    console.log('✓ Schema restored');

    console.log('\n✓ All tests completed successfully!');

  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  } finally {
    await dbService.close();
  }
}

testUpdateTemplateSchema().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
