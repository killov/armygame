<?php
if(isset($p[1])){
        $us = new user();
	$us->nacti($p[1]);
	if(!$us->data){
		exit;
	}
}else{
	$us = $user;
}

$profil = $us->data;
$m = $us->mesta();


?>
<h2><?php echo $lang[32]." ".htmlspecialchars($profil["jmeno"]);?>
<?php if($profil["id"] != $user->data["id"]){ ?>
<span class="zp"><a href="#" onClick="otevrichat(<?php echo $profil["id"];?>);return false"><?php echo $lang[51];?></a></span>
<?php } ?>
</h2>
<table class="profil">
<tr><th><?php echo $lang[34];?></th><th><?php echo $lang[35];?></th></tr>
<tr>
<td>
	<table class="profil1">
		<tr><td><?php echo $lang[40];?>: </td><td><?php echo $profil["poradi"];?></td></tr>
		<tr><td><?php echo $lang[36];?>: </td><td><?php echo $profil["pop"];?></td></tr>
		<tr><td><?php echo $lang[37];?>: </td><td><?php echo $profil["mest"];?></td></tr>
                <tr><td><?php echo $lang[89];?>: </td><td><?php if($profil["stat"] != 0){echo "<a href=\"#\" onMouseDown=\"page_load('stat&id=".$profil["stat"]."')\" onMouseUp=\"page_draw()\">".  htmlspecialchars($profil["statjmeno"])."</a>";}?></td></tr>
	</table>
</td>
<td>

</td>
</tr>
</table>

<table class="profil3">
<tr><th><?php echo $lang[38];?></th><th><?php echo $lang[36];?></th><th><?php echo $lang[39];?></th></tr>
<?php
if($m){
	foreach($m as $d){
		echo "<tr><td><a href=\"#\" h=\"mestoinfo/".$d["id"]."\" class=\"link\">".htmlspecialchars($d["jmeno"])."</a></td><td>".$d["populace"]."</td><td><a href=\"#\"onMouseDown=\"showmap(),mapa_pozice(".$d["x"].",".$d["y"].");\">".$d["x"]."/".$d["y"]."</a></td></tr>";
	}
}
?>

</table>