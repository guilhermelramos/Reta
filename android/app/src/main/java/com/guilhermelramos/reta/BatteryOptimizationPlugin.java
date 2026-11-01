package com.guilhermelramos.reta;

import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte mínima para a otimização de bateria do Android, que não tem API
 * oficial no Capacitor.
 *
 * Não pedimos REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: o app apenas consulta o
 * estado e abre a lista do sistema para o usuário decidir.
 */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        PowerManager power = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignoring = power != null
                && power.isIgnoringBatteryOptimizations(getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("ignoring", ignoring);
        call.resolve(result);
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Não consegui abrir as configurações de bateria.", error);
        }
    }
}
