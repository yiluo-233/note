; 自定义安装页面：现代文件夹选择、可选快捷方式及简洁完成页面。
!include nsDialogs.nsh
!include FileFunc.nsh

!ifndef BUILD_UNINSTALLER
Var notePathControl
Var noteDesktopControl
Var noteStartMenuControl
Var noteDesktopState
Var noteStartMenuState
Var noteOptionsInitialized
Var noteOptionsAccepted
Var noteSelectedFolder
Var noteRunControl

!macro customInit
  StrCpy $noteOptionsInitialized 0
  StrCpy $noteOptionsAccepted 0
!macroend

!macro customPageAfterChangeDir
  Page custom NoteOptionsPage NoteOptionsLeave
!macroend

!macro customFinishPage
  Page custom NoteFinishPage NoteFinishLeave
!macroend

!macro customInstall
  ; 自动更新和静默安装不经过选项页，继续使用内置的快捷方式保留逻辑。
  ${If} $noteOptionsAccepted == 1
    ${If} $noteDesktopState == ${BST_CHECKED}
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${Else}
      Delete "$newDesktopLink"
    ${EndIf}
    ${If} $noteStartMenuState == ${BST_CHECKED}
      !insertmacro createMenuDirectory
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${Else}
      Delete "$newStartMenuLink"
    ${EndIf}
    ; 完成页不能再通过刚被取消的开始菜单快捷方式启动程序。
    StrCpy $launchLink "$appExe"
  ${EndIf}
!macroend

!macro customHeader
Function NoteOptionsPage
  ${If} ${isUpdated}
    Abort
  ${EndIf}

  ${If} $noteOptionsInitialized == 0
    StrCpy $noteDesktopState ${BST_CHECKED}
    StrCpy $noteStartMenuState ${BST_CHECKED}
    ; 重装时按现有快捷方式初始化，尊重用户此前删除或取消的选择。
    ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $0 != ""
      !insertmacro setLinkVars
      ${IfNot} ${FileExists} "$oldDesktopLink"
        StrCpy $noteDesktopState ${BST_UNCHECKED}
      ${EndIf}
      ${IfNot} ${FileExists} "$oldStartMenuLink"
        StrCpy $noteStartMenuState ${BST_UNCHECKED}
      ${EndIf}
    ${EndIf}
    StrCpy $noteOptionsInitialized 1
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "安装 note" "选择安装位置及快捷方式。"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 12u "安装位置"
  Pop $0
  ${NSD_CreateText} 0 18u 78% 14u "$INSTDIR"
  Pop $notePathControl
  ${NSD_CreateButton} 80% 18u 20% 14u "浏览…"
  Pop $0
  ${NSD_OnClick} $0 NoteBrowseFolder

  ${NSD_CreateCheckbox} 0 57u 100% 14u "创建桌面快捷方式"
  Pop $noteDesktopControl
  ${NSD_SetState} $noteDesktopControl $noteDesktopState
  ${NSD_CreateCheckbox} 0 81u 100% 14u "添加到开始菜单"
  Pop $noteStartMenuControl
  ${NSD_SetState} $noteStartMenuControl $noteStartMenuState
  ${NSD_CreateLabel} 0 112u 100% 24u "作品库和设置保存在用户数据目录中。"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function NoteOptionsLeave
  ${NSD_GetText} $notePathControl $0
  ${GetRoot} "$0" $1
  ${If} $0 == ""
  ${OrIf} $1 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "请输入完整的安装路径。"
    Abort
  ${EndIf}
  ClearErrors
  GetFullPathName $2 "$0"
  ${If} ${Errors}
  ${OrIf} $2 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "安装路径无效，请重新选择。"
    Abort
  ${EndIf}
  ${GetFileName} "$2" $1
  ${If} $1 != "${APP_FILENAME}"
    StrCpy $2 "$2\${APP_FILENAME}"
  ${EndIf}
  StrCpy $INSTDIR "$2"
  ${NSD_SetText} $notePathControl "$INSTDIR"
  ${NSD_GetState} $noteDesktopControl $noteDesktopState
  ${NSD_GetState} $noteStartMenuControl $noteStartMenuState
  StrCpy $noteOptionsAccepted 1
FunctionEnd

Function NoteBrowseFolder
  Pop $0 ; nsDialogs 回调传入的按钮句柄。
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  StrCpy $noteSelectedFolder ""
  ; IFileDialog + FOS_PICKFOLDERS：使用带地址栏的系统文件夹选择器。
  System::Call 'ole32::CoCreateInstance(g "{DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7}", p 0, i 1, g "{42F85136-DB7E-439C-85F1-E4075D135FC8}", *p .r0) i.r1'
  ${If} $1 == 0
    System::Call '$0->9(i 0x868) i.r1'
    ${If} $1 == 0
      System::Call '$0->17(w "选择 note 的安装文件夹")'
      ; 默认打开当前输入路径；路径尚不存在时，由系统选择可用位置。
      ${NSD_GetText} $notePathControl $4
      System::Call 'shell32::SHCreateItemFromParsingName(w r4, p 0, g "{43826D1E-E718-42EE-BC55-A1E261C37BFE}", *p .r2) i.r1'
      ${If} $1 == 0
        System::Call '$0->12(p r2)'
        System::Call '$2->2()'
      ${EndIf}
      System::Call '$0->3(p $HWNDPARENT) i.r1'
      ${If} $1 == 0
        System::Call '$0->20(*p .r2) i.r1'
        ${If} $1 == 0
          System::Call '$2->5(i 0x80058000, *p .r3) i.r1'
          ${If} $1 == 0
            System::Call '*$3(&w${NSIS_MAX_STRLEN} .r4)'
            StrCpy $noteSelectedFolder "$4"
            System::Call 'ole32::CoTaskMemFree(p r3)'
          ${EndIf}
          System::Call '$2->2()'
        ${EndIf}
      ${EndIf}
    ${EndIf}
    System::Call '$0->2()'
  ${Else}
    MessageBox MB_OK|MB_ICONINFORMATION "无法打开文件夹选择器，请在安装位置中直接输入路径。"
  ${EndIf}
  ${If} $noteSelectedFolder != ""
    ${GetFileName} "$noteSelectedFolder" $4
    ${If} $4 != "${APP_FILENAME}"
      StrCpy $noteSelectedFolder "$noteSelectedFolder\${APP_FILENAME}"
    ${EndIf}
    ${NSD_SetText} $notePathControl "$noteSelectedFolder"
  ${EndIf}
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

Function NoteFinishPage
  !insertmacro MUI_HEADER_TEXT "安装完成" "note 已安装到你的电脑。"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 8u 100% 24u "安装已完成，点击“完成”关闭安装程序。"
  Pop $0
  ${NSD_CreateCheckbox} 0 52u 100% 14u "启动 note"
  Pop $noteRunControl
  ${NSD_SetState} $noteRunControl ${BST_CHECKED}
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:完成"
  nsDialogs::Show
FunctionEnd

Function NoteFinishLeave
  ${NSD_GetState} $noteRunControl $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $1 ""
    ${If} ${isUpdated}
      StrCpy $1 "--updated"
    ${EndIf}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  ${EndIf}
FunctionEnd
!macroend
!endif
