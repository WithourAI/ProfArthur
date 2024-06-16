# Stage 1: Build the Angular app

# Use the official Node.js 20 image as the base
FROM node:20 AS build

# Install PNPM globally
RUN npm install -g pnpm

# Set the working directory inside the container
WORKDIR /app

# Copy the pnpm-lock.yaml and package.json files to the working directory
COPY pnpm-lock.yaml package.json ./

# Install the app dependencies using PNPM
RUN pnpm install --frozen-lockfile

# Copy the entire app source code to the working directory
COPY . .

# Build the Angular app for production using PNPM
RUN pnpm run build:prod

# Stage 2: Serve the Angular app using Nginx
FROM nginx:latest

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]