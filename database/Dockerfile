FROM postgres:15

# Copy initialization scripts
# These are automatically executed by PostgreSQL on first container start
COPY init/schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY init/seed.sql /docker-entrypoint-initdb.d/02-seed.sql

# Set environment variables
ENV POSTGRES_DB=mcp_tasks
ENV POSTGRES_USER=mcp_user
ENV POSTGRES_PASSWORD=mcp_password

EXPOSE 5432

# Use the default PostgreSQL entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]