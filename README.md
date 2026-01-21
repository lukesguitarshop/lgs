# Luke's Guitar Shop

A comprehensive price tracking system for Gibson guitars, leveraging real-time market data from Reverb to help collectors, dealers, and enthusiasts make informed buying and selling decisions.

## Overview

Reverb style shop page with a scraper that pulls Luke's Guitar Shop Listings from the reverb.

## Tech Stack

### Backend
- **.NET 9.0**: Modern C# backend services
  - **GuitarDb.API**: RESTful Web API for data access
  - **GuitarDb.Scraper**: Console application for automated data collection
- **MongoDB**: NoSQL database for storing guitar listings and historical data
- **Reverb API**: Source for guitar marketplace data

### Frontend
- **Next.js**: React-based framework for the web interface
- **TypeScript**: Type-safe frontend development
- **TailwindCSS**: Modern utility-first styling

## Project Structure

```
guitar-price-db/
├── backend/
│   ├── GuitarDb.API/          # Web API project
│   └── GuitarDb.Scraper/      # Data scraper console app
├── frontend/                   # Next.js application (coming soon)
├── docs/
│   ├── SETUP.md               # Setup and installation guide
│   └── DATABASE_SCHEMA.md     # MongoDB schema documentation
├── GuitarDb.sln               # .NET solution file
└── README.md                  # This file
```

## Getting Started

### Prerequisites

- .NET 9.0 SDK or later
- MongoDB (local or cloud instance)
- Node.js 18+ (for frontend development)
- Reverb API credentials

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd guitar-price-db
   ```

2. **Set up MongoDB**
   - Install MongoDB locally or set up a cloud instance (MongoDB Atlas)
   - Create a database named `GuitarPriceDb`

3. **Configure the backend**
   - Add your MongoDB connection string and Reverb API credentials to `appsettings.json`
   - See `docs/SETUP.md` for detailed configuration instructions

4. **Run the API**
   ```bash
   cd backend/GuitarDb.API
   dotnet run
   ```

5. **Run the scraper**
   ```bash
   cd backend/GuitarDb.Scraper
   dotnet run
   ```

6. **Set up the frontend** (coming soon)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Documentation

- **[Setup Guide](docs/SETUP.md)**: Detailed installation and configuration instructions
- **[Database Schema](docs/DATABASE_SCHEMA.md)**: MongoDB collection structure and data models

## API Endpoints

The API will provide endpoints for:
- Searching guitars by model, year, condition
- Retrieving price history for specific models
- Getting market statistics and trends
- Managing favorite listings and alerts

Detailed API documentation will be available via Swagger UI at `/swagger` when running the API.

## Roadmap

- [ ] Core API implementation
- [ ] MongoDB integration with proper indexing
- [ ] Reverb API scraper implementation
- [ ] Scheduled scraping jobs
- [ ] Next.js frontend with search and filtering
- [ ] Price trend visualizations
- [ ] User authentication and favorites
- [ ] Email alerts for price drops

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is for educational and personal use. Please respect Reverb's terms of service and API rate limits.

## Acknowledgments

- Reverb for providing marketplace data via their API
- Gibson guitar enthusiasts and collectors community
