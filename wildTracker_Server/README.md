<p align="center">
  <a href="https://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
  <a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
</p>

# WildTracker NestJS Backend

WildTracker is a cross-platform mobile application that focuses on tracking, reporting, and monitoring monkeys ethically and responsibly.  
This **NestJS backend** powers the mobile app, handling data storage, real-time updates, user authentication, and API communication.

## Features

- **User Management:** Role-based access for Reporters and Adopters/Responders  
- **Sightings Management:** Submit, update, retrieve, and delete monkey sightings with images, descriptions, and GPS locations  
- **Real-Time Communication:** Live video streaming and chat between users for coordination and verification  
- **Location Services:** Geolocation support for interactive maps and proximity alerts  
- **Simulated Adoption:** Symbolic adoption workflow and educational checkout process  
- **Secure APIs:** JWT authentication and secure REST endpoints  
- **Database Integration:** Type-safe Prisma ORM with PostgreSQL for scalable data management  

## Tech Stack

- **Framework:** NestJS  
- **Database:** PostgreSQL  
- **ORM:** Prisma  
- **Authentication:** JWT  
- **Real-Time Features:** WebSocket or server-sent events  
- **Architecture:** Modular, MVVM-compatible, RESTful APIs  

## Project Setup

```bash
# Install dependencies
npm install

# Development
npm run start

# Watch mode
npm run start:dev

# Production
npm run start:prod

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

## Deployment

For production deployment, you can follow the official [NestJS deployment guide](https://docs.nestjs.com/deployment).  

### Deploying on Hetzner VPS using Dokploy

1. **Install Dokploy CLI** (on your local machine)
```bash
npm install -g dokploy