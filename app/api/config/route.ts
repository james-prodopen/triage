import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const configPath = join(process.cwd(), 'config.json');
    const fileContents = await readFile(configPath, 'utf8');
    const config = JSON.parse(fileContents);

    return NextResponse.json(config);
  } catch (error) {
    // Return default config if file doesn't exist
    return NextResponse.json(
      {
        repositories: [],
        authors: [],
        bugfixPRsQuery: 'is:pr fix in:title created:>2025-01-01 sort:created-desc',
        totalPRsQuery: 'is:pr created:>2025-01-01 sort:created-desc'
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const config = await request.json();
    const configPath = join(process.cwd(), 'config.json');

    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
