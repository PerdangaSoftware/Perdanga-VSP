#define MyAppName "Perdanga VSP"
#define MyAppVersion "1.0"
#define MyAppPublisher "Perdanga Software"
#define MyAppURL "https://gitlab.com/perdanga/perdanga-vsp"
#define MyAppExeName "PerdangaVSP.exe"
#define MyAppAssocName MyAppName + " Media File"
#define MyAppAssocExt ".mp4"
#define MyAppAssocKey StringChange(MyAppAssocName, " ", "") + MyAppAssocExt

[Setup]
AppId={{D8A1476B-6532-4752-B31F-72A8B5CD7098}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
UninstallDisplayIcon={app}\ui\ico\GreenOrange.ico
OutputDir=dist
OutputBaseFilename=PerdangaVSP_Setup
SetupIconFile=ui\ico\GreenOrange.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
ChangesAssociations=yes

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

; Кастомизация финального экрана приветствия со слоганом
[Messages]
russian.FinishedHeadingLabel=Perdanga Forever!
russian.FinishedLabel=Программа [name] успешно установлена на ваш компьютер.%n%nPerdanga Forever!
english.FinishedHeadingLabel=Perdanga Forever!
english.FinishedLabel=[name] has been successfully installed on your computer.%n%nPerdanga Forever!

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "associatefiles"; Description: "Ассоциировать с медиафайлами (.mp4, .mkv, .avi, .webm, и др.)"; GroupDescription: "Ассоциации файлов:"

[Files]
Source: "build\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\*.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\ui\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\ui\ico\GreenOrange.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\ui\ico\GreenOrange.ico"; Tasks: desktopicon

; Регистрация ассоциаций файлов
[Registry]
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Media"; ValueType: string; ValueName: ""; ValueData: "Media File (Perdanga VSP)"; Flags: uninsdeletekey; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Media\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\ui\ico\GreenOrange.ico,0"; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Media\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associatefiles

Root: HKA; Subkey: "Software\Classes\.mp4\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.mkv\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.webm\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.avi\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.mov\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.mp3\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.flac\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
Filename: "{#MyAppURL}"; Description: "Посетить страницу проекта на GitLab"; Flags: shellexec postinstall unchecked

[Code]
// Кликабельная ссылка на GitLab в левом нижнем углу установщика
procedure URLLabelOnClick(Sender: TObject);
var
  ErrorCode: Integer;
begin
  ShellExec('open', '{#MyAppURL}', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
end;

procedure InitializeWizard();
var
  URLLabel: TLabel;
begin
  URLLabel := TLabel.Create(WizardForm);
  URLLabel.Parent := WizardForm;
  URLLabel.Left := ScaleX(18);
  URLLabel.Top := WizardForm.CancelButton.Top + ScaleY(4);
  URLLabel.Caption := 'GitLab: perdanga/perdanga-vsp';
  URLLabel.Cursor := crHand;
  URLLabel.Font.Color := $3860D7; // Фирменный терракотовый цвет (BGR)
  URLLabel.Font.Style := [fsUnderline];
  URLLabel.OnClick := @URLLabelOnClick;
end;