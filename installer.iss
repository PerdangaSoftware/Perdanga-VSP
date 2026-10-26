#define MyAppName "Perdanga VSP"
#define MyAppVersion "1.2"
#define MyAppPublisher "Perdanga Software"
#define MyAppURL "https://github.com/PerdangaSoftware/Perdanga-VSP"
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
DisableDirPage=no
UninstallDisplayIcon={app}\ui\ico\GreenOrange.ico
OutputDir=dist
OutputBaseFilename=PerdangaVSP_Setup
SetupIconFile=ui\ico\GreenOrange.ico
WizardImageFile=WizardImage.bmp,WizardImage200.bmp
WizardSmallImageFile=VspLogo.bmp,VspLogo200.bmp
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMANumBlockThreads=4
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
ChangesAssociations=yes
ShowLanguageDialog=yes
LanguageDetectionMethod=none
UsePreviousLanguage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[CustomMessages]
english.AssocGroup=File Associations:
english.AssocTasks=Associate with media files (Video & Audio: .mp4, .mkv, .mp3, .wav, etc.)
english.VisitWebRun=Visit official website
english.VisitGitHubRun=View source code on GitHub
english.DevelopedBy=Developed by Perdanga Software
english.WebsiteLink=Website
english.GitHubLink=GitHub

russian.AssocGroup=Ассоциации файлов:
russian.AssocTasks=Ассоциировать с медиафайлами (Видео и Аудио: .mp4, .mkv, .mp3, .wav, и др.)
russian.VisitWebRun=Посетить официальный сайт
russian.VisitGitHubRun=Посетить репозиторий проекта
russian.DevelopedBy=Разработано Perdanga Software
russian.WebsiteLink=Сайт
russian.GitHubLink=Репозиторий

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
Source: "build\mpv.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\ui\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.txt,*.map,*.bak,*.md"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\ui\ico\GreenOrange.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\ui\ico\GreenOrange.ico"; Tasks: desktopicon

[Registry]
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Video"; ValueType: string; ValueName: ""; ValueData: "Perdanga VSP Video File"; Flags: uninsdeletekey; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Video\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\ui\ico\video.ico,0"; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Video\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associatefiles

Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Audio"; ValueType: string; ValueName: ""; ValueData: "Perdanga VSP Audio File"; Flags: uninsdeletekey; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Audio\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\ui\ico\audio.ico,0"; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\PerdangaVSP.Audio\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associatefiles

Root: HKA; Subkey: "Software\Classes\.mp4\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.mkv\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.webm\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.avi\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.mov\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.wmv\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.flv\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.ts\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.m4v\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Video"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles

Root: HKA; Subkey: "Software\Classes\.mp3\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.wav\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.flac\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.ogg\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.m4a\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.aac\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.opus\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.wma\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.alac\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.ac3\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles
Root: HKA; Subkey: "Software\Classes\.dts\OpenWithProgids"; ValueType: string; ValueName: "PerdangaVSP.Audio"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associatefiles

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
Filename: "{#MyAppWebURL}"; Description: "{cm:VisitWebRun}"; Flags: shellexec postinstall unchecked
Filename: "{#MyAppURL}"; Description: "{cm:VisitGitHubRun}"; Flags: shellexec postinstall unchecked

[Code]
const
  COLOR_BG_DARK    = $141512;
  COLOR_SURFACE    = $1D201A;
  COLOR_TERRACOTTA = $3572FF;
  COLOR_SAGE       = $B5C7B8;
  COLOR_TEXT_WHITE = $FFFFFF;
  COLOR_MUTED      = $808F85;

procedure WebLabelOnClick(Sender: TObject);
var
  ErrorCode: Integer;
begin
  ShellExec('open', '{#MyAppWebURL}', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
end;

procedure GitHubLabelOnClick(Sender: TObject);
var
  ErrorCode: Integer;
begin
  ShellExec('open', '{#MyAppURL}', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
end;

procedure ApplyCustomArtworkTheme();
begin
  WizardForm.Color := COLOR_BG_DARK;
  WizardForm.InnerPage.Color := COLOR_BG_DARK;
  WizardForm.MainPanel.Color := COLOR_SURFACE;

  WizardForm.WelcomePage.Color := COLOR_BG_DARK;
  WizardForm.FinishedPage.Color := COLOR_BG_DARK;

  WizardForm.Bevel.Visible := False;

  WizardForm.PageNameLabel.Font.Color := COLOR_TERRACOTTA;
  WizardForm.PageNameLabel.Font.Style := [fsBold];
  WizardForm.PageDescriptionLabel.Font.Color := COLOR_SAGE;

  WizardForm.WelcomeLabel1.Font.Color := COLOR_TERRACOTTA;
  WizardForm.WelcomeLabel1.Font.Style := [fsBold];
  WizardForm.WelcomeLabel2.Font.Color := COLOR_TEXT_WHITE;

  WizardForm.FinishedHeadingLabel.Font.Color := COLOR_TERRACOTTA;
  WizardForm.FinishedHeadingLabel.Font.Style := [fsBold];
  WizardForm.FinishedLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.RunList.Color := COLOR_BG_DARK;
  WizardForm.RunList.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.RunList.BorderStyle := bsNone;

  WizardForm.SelectDirLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.SelectDirBrowseLabel.Font.Color := COLOR_SAGE;
  WizardForm.DirEdit.Color := COLOR_SURFACE;
  WizardForm.DirEdit.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.DiskSpaceLabel.Font.Color := COLOR_SAGE;

  WizardForm.SelectTasksLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.TasksList.Color := COLOR_SURFACE;
  WizardForm.TasksList.Font.Color := COLOR_TEXT_WHITE;

  WizardForm.ReadyLabel.Font.Color := COLOR_TEXT_WHITE;
  WizardForm.ReadyMemo.Color := COLOR_SURFACE;
  WizardForm.ReadyMemo.Font.Color := COLOR_TEXT_WHITE;

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
  DevLabel, Sep1Label, WebLabel, Sep2Label, GitHubLabel: TLabel;
begin
  ApplyCustomArtworkTheme();

  DevLabel := TLabel.Create(WizardForm);
  DevLabel.Parent := WizardForm;
  DevLabel.Left := ScaleX(18);
  DevLabel.Top := WizardForm.CancelButton.Top + ScaleY(5);
  DevLabel.Caption := ExpandConstant('{cm:DevelopedBy}');
  DevLabel.Font.Color := COLOR_MUTED;
  DevLabel.Font.Size := 8;

  Sep1Label := TLabel.Create(WizardForm);
  Sep1Label.Parent := WizardForm;
  Sep1Label.Left := DevLabel.Left + DevLabel.Width + ScaleX(6);
  Sep1Label.Top := DevLabel.Top;
  Sep1Label.Caption := #$2022;
  Sep1Label.Font.Color := COLOR_MUTED;
  Sep1Label.Font.Size := 8;

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

  Sep2Label := TLabel.Create(WizardForm);
  Sep2Label.Parent := WizardForm;
  Sep2Label.Left := WebLabel.Left + WebLabel.Width + ScaleX(6);
  Sep2Label.Top := DevLabel.Top;
  Sep2Label.Caption := #$2022;
  Sep2Label.Font.Color := COLOR_MUTED;
  Sep2Label.Font.Size := 8;

  GitHubLabel := TLabel.Create(WizardForm);
  GitHubLabel.Parent := WizardForm;
  GitHubLabel.Left := Sep2Label.Left + Sep2Label.Width + ScaleX(6);
  GitHubLabel.Top := DevLabel.Top;
  GitHubLabel.Caption := ExpandConstant('{cm:GitHubLink}');
  GitHubLabel.Cursor := crHand;
  GitHubLabel.Font.Color := COLOR_TERRACOTTA;
  GitHubLabel.Font.Style := [fsUnderline];
  GitHubLabel.Font.Size := 8;
  GitHubLabel.OnClick := @GitHubLabelOnClick;
end;