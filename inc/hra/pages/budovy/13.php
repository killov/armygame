<table class="info">
    <tr><th><?=$lang[31]?>:</th><td><?=$mesto->data["b13"]?></td>
    <?php if($mesto->data["b13"] < $hodnoty["budovy"][13]["maximum"]){ ?>
    <th><?=$lang[61]?>:</th><td><?=cas($mesto->budova_cas($mesto->data["b1"],13,$mesto->data["b13"]+1))?></td>
    <?php } ?>
    </tr>
</table>
