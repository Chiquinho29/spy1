import { type NextRequest, NextResponse } from "next/server"

const API_ENDPOINT = "https://whatsapp-data.p.rapidapi.com/wspicture"
const API_HOST = "whatsapp-data.p.rapidapi.com"
const FALLBACK_PHOTO_URL =
  "https://media.istockphoto.com/id/1337144146/vector/default-avatar-profile-icon-vector.jpg?s=612x612&w=0&k=20&c=BIbFwuv7FxTWvh5S3vB6bkT0Qv8Vn8N5Ffseq84ClGI="

export async function POST(request: NextRequest) {
  try {
    const { phone_number } = await request.json()

    if (!phone_number) {
      return NextResponse.json({ error: "Número de telefone é obrigatório" }, { status: 400 })
    }

    const urlProfile = `https://whatsapp-data1.p.rapidapi.com/number/${phone_number}?base64=false&telegram=false&google=false`

    const response = await fetch(urlProfile, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY || "663753efb4mshcbbdde11e811789p149069jsnd73bd1ba7a71",
        "X-RapidAPI-Host": "whatsapp-data1.p.rapidapi.com",
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: "Erro ao buscar informações do WhatsApp" }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API do WhatsApp:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
