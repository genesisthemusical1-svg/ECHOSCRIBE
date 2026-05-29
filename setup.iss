; =====================================================================
; EchoScribe Cognitive Voice Recorder - Professional Inno Setup Script
; For compiling a standard monolithic setup.exe installer with code-signing support
; =====================================================================

[Setup]
AppId={{D3AC8F72-132A-4FDF-AD2E-6E8E2D99CDD3}
AppName=EchoScribe
AppVersion=1.0.0
AppPublisher=EchoScribe Systems
AppPublisherURL=http://localhost:3000
AppSupportURL=http://localhost:3000
AppUpdatesURL=http://localhost:3000
DefaultDirName={localappdata}\Programs\EchoScribe
DisableProgramGroupPage=yes
LicenseFile=LICENSE_STUB.txt
; Create custom branding icons
SetupIconFile=app-icon.ico
UninstallDisplayIcon={app}\app-icon.ico
OutputBaseFilename=EchoScribe_Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "launch-echoscribe.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "app-icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "tsconfig.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "vite.config.ts"; DestDir: "{app}"; Flags: ignoreversion
Source: "server.ts"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "notes\*"; DestDir: "{app}\notes"; Flags: ignoreversion recursesubdirs createallsubdirs
; Check if portable node is in place
Source: ".local-node\*"; DestDir: "{app}\.local-node"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: HasLocalNode

[Icons]
Name: "{group}\EchoScribe"; Filename: "{app}\launch-echoscribe.bat"; IconFilename: "{app}\app-icon.ico"
Name: "{autodesktop}\EchoScribe"; Filename: "{app}\launch-echoscribe.bat"; IconFilename: "{app}\app-icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\launch-echoscribe.bat"; Description: "Launch EchoScribe Desktop Application"; Flags: postinstall nowait shellexec skipifsilent

[Code]
function HasLocalNode: Boolean;
begin
  Result := DirExists(ExpandConstant('{src}\.local-node')) or FileExists(ExpandConstant('{src}\.local-node\node.exe'));
end;
