# Use the official Bun image as the base image
FROM oven/bun:latest

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and bun.lockb (or bun.lock) to leverage Docker cache
# This step installs dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the SvelteKit application
# This will create the 'build' directory with the static assets
RUN bun run build

# Expose the port that SvelteKit serves on (default is 3000)
EXPOSE 3000

# Command to run the application
# For SvelteKit static adapter, you'd typically serve the 'build' directory
# using a static file server. Here, we'll use 'serve' from 'bun-serve' or similar.
# If you're using @sveltejs/adapter-node, the command would be 'node build/index.js'
# Assuming @sveltejs/adapter-static, we'll use 'bun --bun run build' and then serve the output.
# For static adapter, you need a static file server. Let's assume 'serve' is installed globally or as a dev dependency.
# If not, you might need to add 'bun add serve' or use a different approach.
# For simplicity, let's assume the build output is served by a simple http server.
# A common way to serve SvelteKit static builds is with 'serve' package.
# Let's add 'serve' as a dev dependency and use it.

# Re-evaluating: SvelteKit with adapter-static produces a 'build' directory.
# To serve this, we need a simple static file server.
# Let's use 'serve' package. We'll add it to devDependencies and use it.

# Final command for static adapter:
CMD ["bun", "run", "preview"]
