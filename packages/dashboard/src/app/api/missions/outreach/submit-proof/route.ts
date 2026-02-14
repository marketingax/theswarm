import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authenticateAPI } from '@/lib/middleware';

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
}

// POST /api/missions/outreach/submit-proof
// Agent submits proof of outreach
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateAPI(request, true);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const claimIdStr = formData.get('claim_id');
    const proofType = formData.get('proof_type');
    const proofFile = formData.get('proof_file') as File | null;
    const emailSentTo = formData.get('email_sent_to');
    const recipientName = formData.get('recipient_name');
    const notes = formData.get('notes');

    // Validation
    if (!claimIdStr || !proofType || !proofFile) {
      return NextResponse.json(
        { error: 'Missing required fields: claim_id, proof_type, proof_file' },
        { status: 400 }
      );
    }

    const claimId = parseInt(claimIdStr as string);
    if (isNaN(claimId)) {
      return NextResponse.json(
        { error: 'Invalid claim_id' },
        { status: 400 }
      );
    }

    const validProofTypes = ['screenshot', 'email_header', 'calendar_invite', 'call_recording'];
    if (!validProofTypes.includes(proofType as string)) {
      return NextResponse.json(
        { error: `Invalid proof_type. Must be one of: ${validProofTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Get claim and verify ownership
    const { data: claim, error: claimError } = await db
      .from('claims')
      .select('*, missions:mission_id(id, mission_type, requires_disclosure)')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    if (claim.agent_id !== auth.agentId) {
      return NextResponse.json(
        { error: 'You can only submit proof for your own claims' },
        { status: 403 }
      );
    }

    // For now: Store file as base64 or simulate storage
    // In production: Upload to S3/Supabase storage
    const proofBuffer = await proofFile.arrayBuffer();
    const proofBase64 = Buffer.from(proofBuffer).toString('base64');
    const proofUrl = `data:${proofFile.type};base64,${proofBase64}`;

    // Create proof record
    const { data: proof, error: proofError } = await db
      .from('outreach_proofs')
      .insert({
        claim_id: claimId,
        proof_type: proofType,
        proof_url: proofUrl,
        email_sent_to: emailSentTo,
        recipient_name: recipientName,
        notes: notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (proofError) {
      console.error('Failed to create proof record:', proofError);
      return NextResponse.json(
        { error: 'Failed to submit proof' },
        { status: 500 }
      );
    }

    // Try to auto-verify the proof (check for disclosure)
    let autoVerified = false;
    let disclosureDetected = false;

    try {
      const verification = await autoVerifyProof(proof, proofFile, proofBuffer);
      autoVerified = verification.autoVerified;
      disclosureDetected = verification.disclosureDetected;

      if (autoVerified) {
        // Update proof with verification status
        await db
          .from('outreach_proofs')
          .update({
            auto_verified: true,
            disclosure_present: disclosureDetected,
            verified_at: new Date().toISOString()
          })
          .eq('id', proof.id);

        // Update claim status
        await db
          .from('claims')
          .update({
            status: 'verified',
            submitted_at: new Date().toISOString()
          })
          .eq('id', claimId);
      } else {
        // Update proof for manual review
        await db
          .from('outreach_proofs')
          .update({
            disclosure_present: disclosureDetected
          })
          .eq('id', proof.id);
      }
    } catch (verifyErr) {
      console.warn('Auto-verification failed:', verifyErr);
      // Continue without auto-verification
    }

    return NextResponse.json({
      success: true,
      proof_id: proof.id,
      claim_id: claimId,
      verification_status: autoVerified ? 'verified' : 'pending_manual_review',
      auto_verified: autoVerified,
      disclosure_detected: disclosureDetected,
      message: autoVerified
        ? 'Proof verified! Your USD reward has been credited.'
        : 'Proof submitted for manual review. We\'ll verify within 24 hours.'
    });

  } catch (err) {
    console.error('Submit proof error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}

// Helper: Auto-verify proof
async function autoVerifyProof(
  proof: any,
  file: File,
  buffer: ArrayBuffer
): Promise<{ autoVerified: boolean; disclosureDetected: boolean }> {
  
  const proofType = proof.proof_type;
  
  // Check file size
  if (buffer.byteLength > 50 * 1024 * 1024) {
    throw new Error('File too large (>50MB)');
  }

  let disclosureDetected = false;

  // For screenshots and email headers: try OCR/text extraction
  if (proofType === 'screenshot' || proofType === 'email_header') {
    // Try to detect text in the image
    // For MVP: Just check file exists and is reasonable size
    // In production: Use Tesseract.js or similar for OCR
    
    const textContent = await extractTextFromFile(file, buffer);
    disclosureDetected = checkForDisclosure(textContent);
  }

  // For calendar invites: check file structure
  else if (proofType === 'calendar_invite') {
    const textContent = new TextDecoder().decode(buffer);
    // Check for ICS calendar format
    if (textContent.includes('BEGIN:VCALENDAR') && textContent.includes('END:VCALENDAR')) {
      // Parse ICS and check event
      disclosureDetected = checkForDisclosure(textContent);
    }
  }

  // For call recordings: check audio duration
  else if (proofType === 'call_recording') {
    // Check file header for audio format
    if (isAudioFile(buffer)) {
      disclosureDetected = true; // For MVP, trust that agent did the call
    }
  }

  return {
    autoVerified: disclosureDetected,
    disclosureDetected: disclosureDetected
  };
}

// Helper: Extract text from file (for MVP, simple implementation)
async function extractTextFromFile(file: File, buffer: ArrayBuffer): Promise<string> {
  try {
    // If it's text-based (email header), decode directly
    if (file.type.includes('text') || file.type === 'application/pdf') {
      return new TextDecoder().decode(buffer);
    }

    // For images: in production, use Tesseract.js
    // For MVP: return empty (will require manual verification)
    console.warn('OCR not implemented for images yet. Requires manual verification.');
    return '';
  } catch (err) {
    console.warn('Failed to extract text from file:', err);
    return '';
  }
}

// Helper: Check for disclosure keywords
function checkForDisclosure(text: string): boolean {
  const disclosureKeywords = [
    'openclaw',
    'swarm',
    'ai agent',
    'artificial intelligence agent',
    'autonomous agent',
    'i\'m an agent',
    'i am an agent',
    'this is an agent'
  ];

  const lowerText = text.toLowerCase();
  return disclosureKeywords.some(keyword => lowerText.includes(keyword));
}

// Helper: Check if buffer is audio
function isAudioFile(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer);
  
  // Check for common audio file signatures
  // WAV: RIFF header
  if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
    return true;
  }
  
  // MP3: FF FB or FF FA
  if ((view[0] === 0xFF && view[1] === 0xFB) || (view[0] === 0xFF && view[1] === 0xFA)) {
    return true;
  }
  
  // M4A/MP4: ftyp header
  if (view[4] === 0x66 && view[5] === 0x74 && view[6] === 0x79 && view[7] === 0x70) {
    return true;
  }
  
  // OGG: OggS
  if (view[0] === 0x4F && view[1] === 0x67 && view[2] === 0x67 && view[3] === 0x53) {
    return true;
  }
  
  return false;
}

// GET: Return form template
export async function GET() {
  return NextResponse.json({
    message: 'POST to submit proof of outreach',
    required_fields: {
      claim_id: 'number - Claim ID from mission claim',
      proof_type: 'enum - screenshot, email_header, calendar_invite, call_recording',
      proof_file: 'file - Image, PDF, or audio file',
      email_sent_to: 'string - Email of recipient (optional)',
      recipient_name: 'string - Name of recipient (optional)',
      notes: 'string - Any additional notes (optional)'
    }
  });
}
