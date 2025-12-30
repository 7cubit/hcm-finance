import { google } from 'googleapis';
import { Storage } from '@google-cloud/storage';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import sharp from 'sharp';

// Load environment variables
dotenv.config();

/**
 * Verification Script: Phase 7 Receipt Preservation
 * 
 * Usage: npx ts-node scripts/test-receipt-archival.ts [drive-file-url]
 */

async function main() {
  const driveUrl = process.argv[2];
  if (!driveUrl) {
    console.error('❌ Missing Drive file URL.');
    process.exit(1);
  }

  const fileId = driveUrl.match(/[-\w]{25,}/)?.[0];
  if (!fileId) {
    console.error('❌ Could not extract File ID from URL.');
    process.exit(1);
  }

  console.log(`🧪 Testing Archival for Drive File ID: ${fileId}...`);

  // 1. Auth & Setup
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const credentials = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), keyPath!), 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const storage = new Storage({ credentials });
  const bucketName = process.env.GCP_RECEIPT_BUCKET || 'hcmj-finance-receipts';
  const bucket = storage.bucket(bucketName);

  const localPath = path.join(os.tmpdir(), `test-receipt-${Date.now()}`);
  const thumbPath = `${localPath}_thumb.webp`;

  try {
    // 2. Download from Drive
    console.log('⬇️ Step 1: Downloading from Drive...');
    const dest = fs.createWriteStream(localPath);
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    
    await new Promise((resolve, reject) => {
      res.data
        .on('error', reject)
        .pipe(dest)
        .on('error', reject)
        .on('finish', resolve);
    });
    console.log('✅ File downloaded locally.');

    // 3. Generate Thumbnail
    console.log('🖼️ Step 2: Generating Thumbnail...');
    await sharp(localPath)
      .resize(200, 200, { fit: 'cover' })
      .toFormat('webp')
      .toFile(thumbPath);
    console.log('✅ Thumbnail generated.');

    // 4. Upload to GCS
    console.log(`☁️ Step 3: Uploading to GCS Bucket: ${bucketName}...`);
    const [exists] = await bucket.exists();
    if (!exists) {
      await storage.createBucket(bucketName);
      console.log(`Created bucket ${bucketName}`);
    }

    await bucket.upload(localPath, { destination: `test-archivals/${path.basename(localPath)}.pdf` });
    await bucket.upload(thumbPath, { destination: `test-thumbnails/${path.basename(thumbPath)}` });
    
    console.log('🚀 Archival Successful!');
    console.log(`Check GCS at: https://console.cloud.google.com/storage/browser/${bucketName}`);

  } catch (error: any) {
    console.error(`❌ Test failed: ${error.message}`);
  } finally {
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }
}

main().catch(console.error);
