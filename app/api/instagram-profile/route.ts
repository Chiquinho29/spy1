import { type NextRequest, NextResponse } from "next/server"

const cache = new Map<string, { profile: any; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    // Remove @ if present
    const cleanUsername = username.replace("@", "")

    // Check cache first
    const cached = cache.get(cleanUsername)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("[v0] Returning cached Instagram profile")
      return NextResponse.json(
        {
          success: true,
          profile: cached.profile,
        },
        {
          status: 200,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    const response = await fetch("https://instagram120.p.rapidapi.com/api/instagram/posts", {
      method: "POST",
      headers: {
        "x-rapidapi-key": "58476d898amsh61d6476db2514cfp114ab2jsn8e290bed9186",
        "x-rapidapi-host": "instagram120.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: cleanUsername,
        maxId: "",
      }),
    })

    console.log("[v0] Instagram API status:", response.status)

    if (response.status === 429) {
      console.log("[v0] Rate limit exceeded for Instagram API")
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        },
        {
          status: 429,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    if (!response.ok) {
      console.error("[v0] Instagram API error:", response.status)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch Instagram profile - API returned ${response.status}`,
        },
        {
          status: response.status,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    const data = await response.json()
    console.log("[v0] Instagram API response received")
    console.log("[v0] API Response structure:", JSON.stringify(data).substring(0, 200))

    if (!data) {
      console.log("[v0] Empty response from Instagram API")
      return NextResponse.json(
        {
          success: false,
          error: "Empty response from Instagram API",
        },
        {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    let posts: any[] = []

    // Instagram120 retorna os posts em data.result.edges
    if (data.result && Array.isArray(data.result.edges)) {
      posts = data.result.edges.slice(0, 12).map((edge: any) => {
        const node = edge.node || edge
        return {
          thumbnail: node.display_url || node.thumbnail_src || node.image_versions2?.candidates?.[0]?.url || "",
          caption: node.caption?.text || node.caption || "",
          likes: node.edge_liked_by?.count || node.like_count || 0,
          comments: node.edge_media_to_comment?.count || node.comment_count || 0,
        }
      })
    } else if (Array.isArray(data.edges)) {
      posts = data.edges.slice(0, 12).map((edge: any) => {
        const node = edge.node || edge
        return {
          thumbnail: node.display_url || node.thumbnail_src || node.image_versions2?.candidates?.[0]?.url || "",
          caption: node.caption?.text || node.caption || "",
          likes: node.edge_liked_by?.count || node.like_count || 0,
          comments: node.edge_media_to_comment?.count || node.comment_count || 0,
        }
      })
    }

    const profileData = {
      username: data.username || cleanUsername,
      full_name: data.full_name || data.name || "",
      biography: data.biography || data.bio || "",
      profile_pic_url: data.profile_pic_url || "",
      follower_count: data.follower_count || 0,
      following_count: data.following_count || 0,
      media_count: data.media_count || posts.length || 0,
      is_private: data.is_private || false,
      is_verified: data.is_verified || false,
      category: data.category || "",
      posts: posts,
    }

    console.log("[v0] Extracted profile data with", posts.length, "posts")
    if (posts.length > 0) {
      console.log("[v0] First post thumbnail:", posts[0].thumbnail?.substring(0, 100))
    }

    // Cache the result
    cache.set(cleanUsername, {
      profile: profileData,
      timestamp: Date.now(),
    })

    // Clean up old cache entries
    if (cache.size > 100) {
      const oldestKey = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
      cache.delete(oldestKey)
    }

    return NextResponse.json(
      {
        success: true,
        profile: profileData,
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    )
  } catch (err) {
    console.error("[v0] Error fetching Instagram profile:", err)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    )
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
