import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Cron API is working',
    timestamp: new Date().toISOString(),
    endpoints: {
      backup: '/api/cron/backup (POST)',
      status: '/api/cron/status (POST)',
      test: '/api/cron/test (GET)'
    },
    usage: {
      backup: 'curl -X POST /api/cron/backup -H "Content-Type: application/json" -d \'{"username":"admin","password":"admin123"}\'',
      status: 'curl -X POST /api/cron/status -H "Content-Type: application/json" -d \'{"username":"admin","password":"admin123"}\''
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    
    return NextResponse.json({
      success: true,
      message: 'Test successful - credentials received',
      timestamp: new Date().toISOString(),
      receivedData: {
        username: username ? 'provided' : 'missing',
        password: password ? 'provided' : 'missing'
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Invalid JSON or missing data',
      timestamp: new Date().toISOString()
    }, { status: 400 })
  }
}
