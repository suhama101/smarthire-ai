export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "alive",
    timestamp: new Date().toISOString()
  });
}
