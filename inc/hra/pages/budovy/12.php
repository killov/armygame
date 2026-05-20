<table class="info">
    <tr><th><?=$lang[31]?>:</th><td><?=$mesto->data["b12"]?></td>
    <?php if($mesto->data["b12"] < $hodnoty["budovy"][12]["maximum"]){ ?>
    <th><?=$lang[61]?>:</th><td><?=cas($mesto->budova_cas($mesto->data["b1"],12,$mesto->data["b12"]+1))?></td>
    <?php } ?>
    </tr>
</table>
