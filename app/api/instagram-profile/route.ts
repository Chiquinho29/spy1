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
        "x-rapidapi-key": "f74236b7e6msh8ca93f03154347cp11c3bfjsn68a073735bf1",
        "x-rapidapi-host": "instagram120.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: cleanUsername,
        maxId: "",
      }),
    })

    console.log("[v0] Instagram API status:", response.status)

    // Get response text first to debug
    const responseText = await response.text()
    console.log("[v0] Instagram API raw response:", responseText.substring(0, 200))

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
      console.error("[v0] Instagram API error:", response.status, responseText)
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

    // Try to parse JSON
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error("[v0] Failed to parse Instagram response as JSON:", responseText.substring(0, 100))
      return NextResponse.json(
        {
          success: false,
          error: "Invalid response from Instagram API",
        },
        {
          status: 502,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    console.log("[v0] Instagram API parsed data:", JSON.stringify(data, null, 2))

    if (!data || !data.data) {
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

    const userData = data.data.user || data.data
    const posts = data.data.items || data.data.posts || []

    const profileData = {
      username: userData.username || cleanUsername,
      full_name: userData.full_name || userData.fullName || userData.name || "",
      biography: userData.biography || userData.bio || "",
      profile_pic_url:
        userData.profile_pic_url ||
        userData.profile_pic_url_hd ||
        userData.profilePicUrl ||
        userData.profilePic ||
        userData.hd_profile_pic_url_info?.url ||
        "",
      follower_count: userData.follower_count || userData.followerCount || userData.edge_followed_by?.count || 0,
      following_count: userData.following_count || userData.followingCount || userData.edge_follow?.count || 0,
      media_count: userData.media_count || userData.mediaCount || userData.edge_owner_to_timeline_media?.count || 0,
      is_private: userData.is_private || userData.isPrivate || false,
      is_verified: userData.is_verified || userData.isVerified || false,
      category: userData.category || "",
      posts: posts.slice(0, 12).map((post: any) => ({
        id: post.id || post.pk || "",
        thumbnail: post.thumbnail_url || post.image_versions2?.candidates?.[0]?.url || post.display_url || "",
        caption: post.caption?.text || post.caption || "",
        like_count: post.like_count || post.likeCount || 0,
        comment_count: post.comment_count || post.commentCount || 0,
        media_type: post.media_type || post.type || 1,
      })),
    }

    console.log("[v0] Extracted profile data with posts:", JSON.stringify(profileData, null, 2))

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
