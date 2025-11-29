package com.example.bit_festival

import android.content.Context
import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import java.nio.charset.StandardCharsets

class NearbyManager(
    private val context: Context,
    private val onStatusUpdate: (String) -> Unit,
    private val onLocationReceived: (Double, Double) -> Unit,
    private val onConnected: (String) -> Unit // <--- NEW: Trigger to send data
) {

    private val STRATEGY = Strategy.P2P_CLUSTER
    private val SERVICE_ID = "com.example.bit_festival"
    private val TAG = "NearbyManager"
    private var myNickname: String = ""

    fun startAdvertising(nickname: String) {
        this.myNickname = nickname
        val advertisingOptions = AdvertisingOptions.Builder().setStrategy(STRATEGY).build()
        Nearby.getConnectionsClient(context)
            .startAdvertising(
                nickname,
                SERVICE_ID,
                connectionLifecycleCallback,
                advertisingOptions
            )
            .addOnSuccessListener {
                Log.d(TAG, "Advertising...")
                onStatusUpdate("Broadcasting as $nickname...")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Advertising failed", e)
                onStatusUpdate("Broadcast failed: ${e.message}")
            }
    }

    fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder().setStrategy(STRATEGY).build()
        Nearby.getConnectionsClient(context)
            .startDiscovery(
                SERVICE_ID,
                endpointDiscoveryCallback,
                discoveryOptions
            )
            .addOnSuccessListener {
                Log.d(TAG, "Discovering...")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Discovery failed", e)
                onStatusUpdate("Search failed: ${e.message}")
            }
    }

    fun sendLocation(lat: Double, lng: Double, endpointId: String) {
        // Format: "LOC:latitude,longitude"
        val msg = "LOC:$lat,$lng"
        Log.d(TAG, "Sending Location: $msg to $endpointId")
        val bytes = msg.toByteArray(StandardCharsets.UTF_8)
        Nearby.getConnectionsClient(context).sendPayload(endpointId, Payload.fromBytes(bytes))
    }

    fun stopAll() {
        Nearby.getConnectionsClient(context).stopAdvertising()
        Nearby.getConnectionsClient(context).stopDiscovery()
        Nearby.getConnectionsClient(context).stopAllEndpoints()
        onStatusUpdate("Ready to connect")
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            Log.d(TAG, "Connection initiated with ${info.endpointName}")
            onStatusUpdate("Found ${info.endpointName}! Connecting...")
            // Always accept connection
            Nearby.getConnectionsClient(context).acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                Log.d(TAG, "Connected!")
                onStatusUpdate("Connected! Swapping GPS Data...")

                // Stop discovery to save battery
                Nearby.getConnectionsClient(context).stopAdvertising()
                Nearby.getConnectionsClient(context).stopDiscovery()

                // TRIGGER THE UI TO SEND LOCATION
                onConnected(endpointId)
            } else {
                onStatusUpdate("Connection failed. Retrying...")
            }
        }

        override fun onDisconnected(endpointId: String) {
            Log.d(TAG, "Disconnected")
            onStatusUpdate("Disconnected from peer.")
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.BYTES) {
                val message = String(payload.asBytes()!!, StandardCharsets.UTF_8)
                Log.d(TAG, "Received Payload: $message")

                if (message.startsWith("LOC:")) {
                    try {
                        val parts = message.removePrefix("LOC:").split(",")
                        if (parts.size == 2) {
                            val lat = parts[0].toDouble()
                            val lng = parts[1].toDouble()
                            // Pass the coordinates back to MainActivity
                            onLocationReceived(lat, lng)
                            onStatusUpdate("Target Acquired!") // Fun status update
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing location", e)
                    }
                }
            }
        }
        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {}
    }

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String,     info: DiscoveredEndpointInfo) {
            Log.d(TAG, "Found peer: ${info.endpointName}")

            // TIE BREAKER: Only alphabetic winner requests connection
            if (myNickname > info.endpointName) {
                onStatusUpdate("Found ${info.endpointName}. Requesting connection...")
                Nearby.getConnectionsClient(context)
                    .requestConnection(myNickname, endpointId, connectionLifecycleCallback)
            } else {
                onStatusUpdate("Found ${info.endpointName}. Waiting for them...")
            }
        }
        override fun onEndpointLost(endpointId: String) {}
    }
}