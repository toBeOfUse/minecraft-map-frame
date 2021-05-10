Get-ChildItem "./" -Filter map_*.dat | 
Foreach-Object {
	Start-Process -FilePath "C:\Users\Extreme PC\Downloads\NBTExplorer-2.8.0\NBTUtil.exe" -ArgumentList "--path=`"$($_.FullName)`" --json=`"$($_.BaseName).json`"" -Wait -NoNewWindow
}