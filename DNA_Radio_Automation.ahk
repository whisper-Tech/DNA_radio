; DNA Radio Player - AutoHotkey Automation Script
; Save as DNA_Radio_Automation.ahk

; == Hotkeys for Development ==

; Ctrl+Alt+R: Start/Restart the Vite Dev Server
^!r::
{
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; taskkill /F /IM node.exe 2>nul; timeout /t 2 /nobreak >nul; npx vite --port 5173\"", , "Hide")
    ShowToast("Vite Server Restarted", "Development server running on port 5173")
}

; Ctrl+Alt+B: Start Backend Server
^!b::
{
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; tsx server/index.ts\"", , "Hide")
    ShowToast("Backend Started", "TypeScript server running")
}

; Ctrl+Alt+T: Run Tests
^!t::
{
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; npm test\"", , "Hide")
    ShowToast("Tests Running", "Executing test suite...")
}

; Ctrl+Alt+O: Open Project in VS Code
^!o::
{
    Run("code C:\Coding\DNA_webapp_player")
    ShowToast("VS Code", "Opening project...")
}

; Ctrl+Alt+G: Git Status
^!g::
{
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; git status\"", , , "Hide")
    ShowToast("Git Status", "Checking repository status...")
}

; == Browser Automation ==

; Ctrl+Alt+1: Open 3D Radio Interface
^!1::
{
    Run("chrome http://localhost:5173/radio-3d")
    ShowToast("3D Radio", "Opening 3D interface...")
}

; Ctrl+Alt+2: Open Main Interface
^!2::
{
    Run("chrome http://localhost:5173")
    ShowToast("Main Interface", "Opening main page...")
}

; Ctrl+Alt+3: Open Admin Dashboard
^!3::
{
    Run("chrome http://localhost:5173/admin")
    ShowToast("Admin Dashboard", "Opening admin panel...")
}

; == Text Expansion ==

; ::dna:: expands to project path
::dna::C:\Coding\DNA_webapp_player

; ::3d:: expands to 3D interface URL
::3d::http://localhost:5173/radio-3d

; ::api:: expands to API base URL
::api::http://localhost:3001/api

; == Window Management ==

; Win+D: Set up development layout
#d::
{
    ; Open VS Code on left half
    Run("code C:\Coding\DNA_webapp_player")
    Sleep(1000)
    
    ; Open browser on right half
    Run("chrome http://localhost:5173/radio-3d")
    Sleep(1000)
    
    ; Open terminal at bottom
    Run("wt -d C:\Coding\DNA_webapp_player")
    Sleep(1000)
    
    ShowToast("Dev Layout", "Development environment ready!")
}

; == Utility Functions ==

ShowToast(title, message) {
    ToolTip(message, 2000)
    SoundPlay("*48")
}

; == Quick Actions ==

; F1: Quick commit
F1::
{
    InputBox(&commitMsg, "Git Commit", "Enter commit message:")
    if (commitMsg) {
        RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; git add .; git commit -m '" commitMsg "'\"", , "Hide")
        ShowToast("Git Commit", "Changes committed!")
    }
}

; F2: Quick push
F2::
{
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; git push\"", , "Hide")
    ShowToast("Git Push", "Changes pushed to remote!")
}

; F3: Install dependencies
F3::
{
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; npm install\"", , "Hide")
    ShowToast("Dependencies", "Installing npm packages...")
}

; == Media Controls for Radio ==

; Media_Play/Pause: Control radio playback
Media_Play_Pause::
{
    ; Send socket event to toggle playback
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; Invoke-RestMethod -Uri 'http://localhost:3001/api/toggle-playback' -Method POST\"", , "Hide")
    ShowToast("Radio Control", "Toggled playback")
}

; Media_Next_Track: Skip to next song
Media_Next_Track::
{
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; Invoke-RestMethod -Uri 'http://localhost:3001/api/next-song' -Method POST\"", , "Hide")
    ShowToast("Radio Control", "Skipped to next song")
}

; == System Monitoring ==

; Ctrl+Alt+S: System Status
^!s::
{
    status := ""
    
    ; Check if Vite is running
    try {
        response := ComObject("MSXML2.XMLHTTP.6.0")
        response.open("GET", "http://localhost:5173", false)
        response.send()
        if (response.status = 200)
            status .= "✅ Vite Server: Running`n"
        else
            status .= "❌ Vite Server: Not responding`n"
    } catch {
        status .= "❌ Vite Server: Offline`n"
    }
    
    ; Check if Backend is running
    try {
        response := ComObject("MSXML2.XMLHTTP.6.0")
        response.open("GET", "http://localhost:3001/api/status", false)
        response.send()
        if (response.status = 200)
            status .= "✅ Backend: Running`n"
        else
            status .= "❌ Backend: Not responding`n"
    } catch {
        status .= "❌ Backend: Offline`n"
    }
    
    ; Check Git status
    RunWait("pwsh -Command \"cd C:\Coding\DNA_webapp_player; git status --porcelain\"", &gitOutput, "Hide")
    if (gitOutput = "")
        status .= "✅ Git: Clean working directory"
    else
        status .= "⚠️ Git: Uncommitted changes"
    
    MsgBox(status, "DNA Radio - System Status", "Iconi")
}

; == Exit Handler ==

; Esc: Emergency stop all servers
Esc::
{
    MsgBox("Stop all development servers?", "Emergency Stop", "4")
    IfMsgBox, Yes
    {
        RunWait("pwsh -Command \"taskkill /F /IM node.exe 2>nul\"", , "Hide")
        ShowToast("Stopped", "All servers stopped")
    }
}
