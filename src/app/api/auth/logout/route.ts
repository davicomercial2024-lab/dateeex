import { NextResponse } from "next/server";

export async function POST() {
  try {
    const response = NextResponse.json({ success: true }, { status: 200 });

    // Expirar o cookie de sessão imediatamente
    response.cookies.set({
      name: "datex_session",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0), // Expirado no passado
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Falha ao processar logout." },
      { status: 500 }
    );
  }
}
