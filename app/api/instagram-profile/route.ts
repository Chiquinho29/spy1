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

    // Fetch Instagram profile data using RapidAPI
    const url = `https://instagram120.p.rapidapi.com/api/instagram/posts`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-key": "58476d898amsh61d6476db2514cfp114ab2jsn8e290bed9186",
        "x-rapidapi-host": "instagram120.p.rapidapi.com",
      },
      body: JSON.stringify({
        username: cleanUsername,
        maxId: "",
      }),
      signal: AbortSignal.timeout?.(10_000),
    })

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
      console.error("[v0] Instagram API returned status:", response.status)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch Instagram profile",
        },
        {
          status: response.status,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    const data = await response.json()

    console.log("[v0] Instagram API raw response structure keys:", Object.keys(data))

    if (!data || !data.data) {
      console.log("[v0] Invalid response from Instagram API - missing data field")
      return NextResponse.json(
        {
          success: false,
          error: "Profile not found",
        },
        {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    // Extract user data from the nested structure
    const userInfo = data.data.user || {}
    const itemsList = data.data.items || []

    // Extract profile picture from various possible fields in the response
    const profilePicUrl =
      userInfo.profile_pic_url || userInfo.hd_profile_pic_url_info?.url || userInfo.profile_pic_url_wrapped || ""

    console.log("[v0] Extracted profile picture URL:", profilePicUrl)

    const profileData = {
      username: userInfo.username || cleanUsername,
      full_name: userInfo.full_name || userInfo.name || "",
      biography: userInfo.biography || "",
      profile_pic_url: profilePicUrl,
      follower_count: userInfo.follower_count || 0,
      following_count: userInfo.following_count || 0,
      media_count: userInfo.media_count || itemsList.length || 0,
      is_private: userInfo.is_private || false,
      is_verified: userInfo.is_verified || false,
      // Extract post thumbnails from the items array
      posts: itemsList.slice(0, 12).map((item: any) => ({
        id: item.id || item.pk || "",
        thumbnail: item.image_versions2?.candidates?.[0]?.url || item.display_url || item.thumbnail_url || "",
        caption: item.caption?.text || item.caption || "",
        like_count: item.like_count || 0,
        comment_count: item.comment_count || 0,
      })),
    }

    console.log("[v0] Final extracted profile data:", JSON.stringify(profileData, null, 2))

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
