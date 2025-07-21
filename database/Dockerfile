FROM postgres:15

# Install Node.js for running bootstrap scripts
RUN apt-get update && apt-get install -y nodejs npm && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory
RUN mkdir -p /app
WORKDIR /app

# Copy Node.js scripts and dependencies
COPY package.json ./
COPY migrate.js ./
COPY bootstrap.js ./

# Install Node.js dependencies
RUN npm install

# Copy initialization scripts
COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY seed.sql /docker-entrypoint-initdb.d/02-seed.sql

# No bootstrap script needed

# Set environment variables
ENV POSTGRES_DB=mcp_tasks
ENV POSTGRES_USER=mcp_user
ENV POSTGRES_PASSWORD=mcp_password

EXPOSE 5432

# Use the default PostgreSQL entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]