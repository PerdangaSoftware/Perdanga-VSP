#define MyAppName "Perdanga VSP"
#define MyAppVersion "1.1"
#define MyAppPublisher "Perdanga Software"
#define MyAppURL "https://gitlab.com/perdanga/perdanga-vsp"
#define MyAppWebURL "https://perdanga-vsp.vercel.app/"
#define MyAppExeName "PerdangaVSP.exe"

[Setup]
AppId={{D8A1476B-6532-4752-B31F-72A8B5CD7098}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppWebURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}

; Always prompt user for installation folder
DisableDirPage=no

UninstallDisplayIcon={app}\ui\ico\GreenOrange.ico
OutputDir=dist
OutputBaseFilename=PerdangaVSP_Setup
SetupIconFile=ui\ico\GreenOrange.ico

; Large left banner for Welcome & Finish pages
WizardImageFile=WizardImage.bmp
; Small upper-right icon for inner pages
WizardSmallImageFile=VspLogo.bmp

Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
ChangesAssociations=yes

; Force display of the language selection dialog on startup
ShowLanguageDialog=yes

; Always default to the first language in [Languages] (English) regardless of OS locale
LanguageDetectionMethod=none

; Do not use previously saved language from registry
UsePreviousLanguage=no

; Order in dropdown: English first, Russian second
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[CustomMessages]
; English localization
english.AssocGroup=File Associations:
english.AssocTasks=Associate with media files (Video & Audio: .mp4, .mkv, .mp3, .wav, etc.)
english.VisitWebRun=Visit official website
english.VisitGitLabRun=View source code on GitLab
english.DevelopedBy=Developed by Perdanga Software
english.WebsiteLink=Website
english.GitLabLink=GitLab

; Russian localization
russian.AssocGroup=Ассоциации файлов:
russian.AssocTasks=Ассоциировать с медиафайлами (Видео и Аудио: .mp4, .mkv, .mp3, .wav, и др.)
russian.VisitWebRun=Посетить официальный сайт
russian.VisitGitLabRun=Посетить репозиторий проекта
russian.DevelopedBy=Разработано Perdanga Software
russian.WebsiteLink=Сайт
russian.GitLabLink=Репозиторий

; Slogan is kept once in FinishedHeadingLabel (duplicate removed from FinishedLabel)
[Messages]
english.FinishedHeadingLabel=Perdanga Forever!
english.FinishedLabel=[name] has been successfully installed on your computer.
russian.FinishedHeadingLabel=Перданга Навсегда!
russian.FinishedLabel=Программа [name] успешно установлена на ваш компьютер.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "associatefiles"; Description: "{cm:AssocTasks}"; GroupDescription: "{cm:AssocGroup}"

[Files]
Source: "build\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\*.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\ui\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\ui\ico\GreenOrange.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\ui\ico\GreenOrange.ico"; Tasks: desktopicon

; Register file associations
[Registry]
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Media"; ValueType: string; ValueName: ""; ValueData: "Perdanga VSP Media File"; Flags: uninsdeletekey; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Media\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\ui\ico\GreenOrange.ico,0"; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Media\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associatefiles

; Video formats
Root: HKA; Subkey: "Software\Classes\.mp4\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.mkv\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.webm\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.avi\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.mov\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.wmv\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.flv\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.ts\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.m4v\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles

; Audio formats
Root: HKA; Subkey: "Software\Classes\.mp3\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.wav\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.flac\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.ogg\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.m4a\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.aac\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.opus\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.wma\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.alac\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.ac3\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.dts\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Media"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
Filename: "{#MyAppWebURL}"; Description: "{cm:VisitWebRun}"; Flags: shellexec postinstall unchecked
Filename: "{#MyAppURL}"; Description: "{cm:VisitGitLabRun}"; Flags: shellexec postinstall unchecked

[Code]
// Premium Obsidian & Forest Slate Palette (Delphi BGR format)
const
  COLOR_BG_DARK    = $141512; // Deep Obsidian Forest (#121514)
  COLOR_SURFACE    = $1D201A; // Rich Jade Header & Surface (#1A201D)
  COLOR_TERRACOTTA = $3572FF; // Radiant Warm Terracotta Sun (#FF7235)
  COLOR_SAGE       = $B5C7B8; // Pale Sunbeam Sage (#B8C7B5)
  COLOR_TEXT_WHITE = $FFFFFF; // Crisp Pure White (#FFFFFF)
  COLOR_MUTED      = $808F85; // Subtle Muted Gray-Sage (#858F80)

procedure WebLabelOnClick(Sender: TObject);
var
  ErrorCode: Integer;
begin
  ShellExec('open', '{#MyAppWebURL}', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
end;

procedure GitLabLabelOnClick(Sender: TObject);
var
  ErrorCode: Integer;
begin
  ShellExec('open', '{#MyAppURL}', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
end;

procedure ApplyCustomArtworkTheme();
begin
  // Main form backgrounds
  WizardForm.Color := COLOR_BG_DARK;
  WizardForm.InnerPage.Color := COLOR_BG_DARK;
  WizardForm.MainPanel.Color := COLOR_SURFACE;

  // Welcome & Finish Pages
  WizardForm.WelcomePage.Color := COLOR_BG_DARK;
  WizardForm.FinishedPage.Color := COLOR_BG_DARK;

  // Remove old gray 3D divider lines
  WizardForm.Bevel.Visible := False;

  // Header Titles and Descriptions
  WizardForm.PageNameLabel.Font.Color := COLOR_TERRACOTTA;
  WizardForm.PageNameLabel.Font.Style := [fsBold];
  WizardForm.PageDescriptionLabel.Font.Color := COLOR_SAGE;

  // Welcome Page Labels
  WizardForm.WelcomeLabel1.Font.Color := COLOR_TERRACOTTA;
  WizardForm.WelcomeLabel1.Font.Style := [fsBold];
  WizardForm.WelcomeLabel2.Font.Color := COLOR_TEXT_WHITE;

  // Finished Page Labels & Checkboxes
  WizardForm.FinishedHeadingLabel.Font.Color := COLOR_TERRACOTTA;
  WizardForm.FinishedHeadingLabel.Font.Style := [fsBold];
  WizardForm.FinishedLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.RunList.Color := COLOR_BG_DARK;
  WizardForm.RunList.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.RunList.BorderStyle := bsNone;

  // Directory Selection Page
  WizardForm.SelectDirLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.SelectDirBrowseLabel.Font.Color := COLOR_SAGE;
  WizardForm.DirEdit.Color := COLOR_SURFACE;
  WizardForm.DirEdit.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.DiskSpaceLabel.Font.Color := COLOR_SAGE;

  // Task Selection Page
  WizardForm.SelectTasksLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.TasksList.Color := COLOR_SURFACE;
  WizardForm.TasksList.Font.Color := COLOR_TEXT_WHITE;

  // Ready To Install Page
  WizardForm.ReadyLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.ReadyMemo.Color := COLOR_SURFACE;
  WizardForm.ReadyMemo.Font.Color := COLOR_TEXT_WHITE;

  // Installing Page
  WizardForm.StatusLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.FileNameLabel.Font.Color := COLOR_SAGE;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpSelectDir then
  begin
    WizardForm.DiskSpaceLabel.Font.Color := COLOR_SAGE;
  end
  else if CurPageID = wpFinished then
  begin
    WizardForm.FinishedPage.Color := COLOR_BG_DARK;
    WizardForm.RunList.Color := COLOR_BG_DARK;
    WizardForm.RunList.Font.Color := COLOR_TEXT_WHITE;
  end
  else if CurPageID = wpWelcome then
  begin
    WizardForm.WelcomePage.Color := COLOR_BG_DARK;
  end;
end;

procedure InitializeWizard();
var
  DevLabel, Sep1Label, WebLabel, Sep2Label, GitLabLabel: TLabel;
begin
  ApplyCustomArtworkTheme();

  // Developer attribution label
  DevLabel := TLabel.Create(WizardForm);
  DevLabel.Parent := WizardForm;
  DevLabel.Left := ScaleX(18);
  DevLabel.Top := WizardForm.CancelButton.Top + ScaleY(5);
  DevLabel.Caption := ExpandConstant('{cm:DevelopedBy}');
  DevLabel.Font.Color := COLOR_MUTED;
  DevLabel.Font.Size := 8;

  // Bullet separator 1
  Sep1Label := TLabel.Create(WizardForm);
  Sep1Label.Parent := WizardForm;
  Sep1Label.Left := DevLabel.Left + DevLabel.Width + ScaleX(6);
  Sep1Label.Top := DevLabel.Top;
  Sep1Label.Caption := #$2022;
  Sep1Label.Font.Color := COLOR_MUTED;
  Sep1Label.Font.Size := 8;

  // Website link
  WebLabel := TLabel.Create(WizardForm);
  WebLabel.Parent := WizardForm;
  WebLabel.Left := Sep1Label.Left + Sep1Label.Width + ScaleX(6);
  WebLabel.Top := DevLabel.Top;
  WebLabel.Caption := ExpandConstant('{cm:WebsiteLink}');
  WebLabel.Cursor := crHand;
  WebLabel.Font.Color := COLOR_TERRACOTTA;
  WebLabel.Font.Style := [fsUnderline];
  WebLabel.Font.Size := 8;
  WebLabel.OnClick := @WebLabelOnClick;

  // Bullet separator 2
  Sep2Label := TLabel.Create(WizardForm);
  Sep2Label.Parent := WizardForm;
  Sep2Label.Left := WebLabel.Left + WebLabel.Width + ScaleX(6);
  Sep2Label.Top := DevLabel.Top;
  Sep2Label.Caption := #$2022;
  Sep2Label.Font.Color := COLOR_MUTED;
  Sep2Label.Font.Size := 8;

  // Repository / GitLab link
  GitLabLabel := TLabel.Create(WizardForm);
  GitLabLabel.Parent := WizardForm;
  GitLabLabel.Left := Sep2Label.Left + Sep2Label.Width + ScaleX(6);
  GitLabLabel.Top := DevLabel.Top;
  GitLabLabel.Caption := ExpandConstant('{cm:GitLabLink}');
  GitLabLabel.Cursor := crHand;
  GitLabLabel.Font.Color := COLOR_TERRACOTTA;
  GitLabLabel.Font.Style := [fsUnderline];
  GitLabLabel.Font.Size := 8;
  GitLabLabel.OnClick := @GitLabLabelOnClick;
end;