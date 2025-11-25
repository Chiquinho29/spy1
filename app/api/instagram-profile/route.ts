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

    const response = await fetch(`https://simple-instagram-api.p.rapidapi.com/account-info?username=${cleanUsername}`, {
      method: "GET",
      headers: {
        "x-rapidapi-key": "f74236b7e6msh8ca93f03154347cp11c3bfjsn68a073735bf1",
        "x-rapidapi-host": "simple-instagram-api.p.rapidapi.com",
      },
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
    console.log("[v0] Instagram API data:", JSON.stringify(data, null, 2))

    if (!data || !data.username) {
      console.log("[v0] Invalid response from Instagram API")
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

    const profileData = {
      username: data.username || cleanUsername,
      full_name: data.full_name || data.fullName || data.name || "",
      biography: data.biography || data.bio || "",
      profile_pic_url: data.profile_pic_url || data.profile_pic_url_hd || data.profilePicUrl || "",
      follower_count: data.follower_count || data.followerCount || 0,
      following_count: data.following_count || data.followingCount || 0,
      media_count: data.media_count || data.mediaCount || 0,
      is_private: data.is_private || data.isPrivate || false,
      is_verified: data.is_verified || data.isVerified || false,
      category: data.category || "",
      posts: [], // Simple API may not include posts, will be empty array
    }

    console.log("[v0] Extracted profile data:", JSON.stringify(profileData, null, 2))

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
