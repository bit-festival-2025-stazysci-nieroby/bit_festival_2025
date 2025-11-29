package com.example.bit_festival

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Geocoder
import android.location.Location
import com.google.firebase.firestore.Query
import androidx.compose.foundation.rememberScrollState
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.format.DateUtils
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.ManagedActivityResultLauncher
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.animation.core.tween
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import com.google.firebase.Timestamp
import androidx.core.content.ContextCompat
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import coil.compose.AsyncImage
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import kotlinx.coroutines.delay
import org.osmdroid.views.MapView
import java.util.Locale
import java.util.UUID
import kotlin.math.roundToInt
import androidx.compose.animation.core.animateFloatAsState
import android.location.LocationListener

// --- DATA MODELS ---
data class UserProfile(
    val uid: String = "",
    val displayName: String = "",
    val email: String = "",
    val photoUrl: String = "",
    val description: String = "",
    val tags: List<String> = emptyList(),
    val location: String = "", // Stored as "City, Country"
    val createdAt: Long = 0
)


data class ActivityPost(
    val id: String,
    val userName: String,
    val userAvatarColor: Color,
    val activityType: String,
    val timeAgo: String,
    val location: String,
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val title: String,
    val description: String,
    val friends: List<String>
)

data class ActivityStats(
    val duration: String,
    val distance: String,
    val pace: String,
    val calories: String
)

val AVAILABLE_TAGS = listOf(
    "gym", "running", "cycling",
    "walking", "hiking", "swimming", "basketball", "football",
    "volleyball", "tennis", "padel", "badminton", "climbing",
    "yoga", "boxing",
    "dance", "skating", "skiing", "snowboarding",
    "shopping", "nightlife", "concert", "photography",
    "events", "coffee", "lunch", "tea",
    "study",
    "reading", "coding",
    "music", "gaming", "boardgames", "crafting", "painting", "drawing",
    "writing", "gardening", "learning", "volunteering",
    "outdoor", "picnic", "sightseeing", "birdwatching",
    "meditation"
)

@SuppressLint("MissingPermission")
@Composable
fun LocationUpdatesEffect(
    isActive: Boolean,
    onLocationUpdate: (Location) -> Unit
) {
    val context = LocalContext.current
    val currentOnLocationUpdate by rememberUpdatedState(onLocationUpdate)

    DisposableEffect(isActive) {
        if (!isActive) return@DisposableEffect onDispose { }

        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val listener = LocationListener { location ->
            currentOnLocationUpdate(location)
        }

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            // REQUEST HIGH ACCURACY UPDATES: 500ms or 0 meters
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 500L, 0f, listener)
            locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 500L, 0f, listener)
        }

        onDispose { locationManager.removeUpdates(listener) }
    }
}

// --- COLORS ---
val BrandOrange = Color(0xFFFF5722)
val TagBlue = Color(0xFF448AFF)
val TagRed = Color(0xFFE91E63)
val LightGrayBg = Color(0xFFF5F5F5)
val StatsBg = Color(0xFFF0F0F0)

class MainActivity : ComponentActivity() {
    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize OSM Configuration
        Configuration.getInstance().userAgentValue = packageName

        // Initialize Firebase
        auth = Firebase.auth
        db = Firebase.firestore

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = BrandOrange,
                    background = LightGrayBg,
                    surface = Color.White
                )
            ) {
                // Determine start destination based on Auth state
                val startDest = if (auth.currentUser != null) "check_profile" else "login"
                MainApp(auth, db, startDest)
            }
        }
    }
}

// --- COMPASS HELPER ---
@Composable
fun CompassEffect(onAzimuthChanged: (Float) -> Unit) {
    val context = LocalContext.current
    DisposableEffect(Unit) {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

        val listener = object : SensorEventListener {
            var gravity: FloatArray? = null
            var geomagnetic: FloatArray? = null
            var hasGravity = false
            var hasGeo = false
            // Tweak: Higher alpha = faster response, Lower = smoother
            val alpha = 0.1f

            override fun onSensorChanged(event: SensorEvent?) {
                if (event == null) return
                if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) {
                    if (gravity == null) gravity = event.values
                    else {
                        for (i in 0..2) gravity!![i] = alpha * event.values[i] + (1 - alpha) * gravity!![i]
                    }
                    hasGravity = true
                }
                if (event.sensor.type == Sensor.TYPE_MAGNETIC_FIELD) {
                    if (geomagnetic == null) geomagnetic = event.values
                    else {
                        for (i in 0..2) geomagnetic!![i] = alpha * event.values[i] + (1 - alpha) * geomagnetic!![i]
                    }
                    hasGeo = true
                }
                if (hasGravity && hasGeo) {
                    val R = FloatArray(9)
                    val I = FloatArray(9)
                    if (SensorManager.getRotationMatrix(R, I, gravity, geomagnetic)) {
                        val orientation = FloatArray(3)
                        SensorManager.getOrientation(R, orientation)
                        val azimuth = Math.toDegrees(orientation[0].toDouble()).toFloat()
                        onAzimuthChanged((azimuth + 360) % 360)
                    }
                }
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }
        sensorManager.registerListener(listener, accelerometer, SensorManager.SENSOR_DELAY_UI)
        sensorManager.registerListener(listener, magnetometer, SensorManager.SENSOR_DELAY_UI)
        onDispose { sensorManager.unregisterListener(listener) }
    }
}

// --- LOCATION HELPER ---
@SuppressLint("MissingPermission")
fun getLastKnownLocation(context: Context): Location? {
    val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val providers = locationManager.getProviders(true)
    var bestLocation: Location? = null
    for (provider in providers) {
        val l = locationManager.getLastKnownLocation(provider) ?: continue
        if (bestLocation == null || l.accuracy < bestLocation.accuracy) {
            bestLocation = l
        }
    }
    return bestLocation
}

// Helper: Check if GPS/Location Service is ON
fun isLocationEnabled(context: Context): Boolean {
    val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
}

// Helper: Check Permissions
fun hasRequiredPermissions(context: Context): Boolean {
    val permissions = mutableListOf<String>()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        permissions.add(Manifest.permission.NEARBY_WIFI_DEVICES)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        permissions.add(Manifest.permission.BLUETOOTH_SCAN)
        permissions.add(Manifest.permission.BLUETOOTH_ADVERTISE)
        permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
    }
    permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
    permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)

    for (perm in permissions) {
        if (ContextCompat.checkSelfPermission(context, perm) != PackageManager.PERMISSION_GRANTED) {
            return false
        }
    }
    return true
}

@Composable
fun MainApp(
    auth: FirebaseAuth,
    db: FirebaseFirestore,
    startDestination: String
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val hideBottomBarRoutes = listOf("login", "setup_profile", "check_profile")

    Scaffold(
        bottomBar = {
            if (currentRoute !in hideBottomBarRoutes) {
                NavigationBar(containerColor = Color.White) {
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Home, null) },
                        label = { Text("Feed") },
                        selected = currentRoute == "feed",
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = BrandOrange),
                        onClick = { navController.navigate("feed") }
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Radar, null) },
                        label = { Text("Connect") },
                        selected = currentRoute == "proximity",
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = BrandOrange),
                        onClick = { navController.navigate("proximity") }
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Person, null) },
                        label = { Text("Profile") },
                        selected = currentRoute == "profile",
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = BrandOrange),
                        onClick = { navController.navigate("profile") }
                    )
                }
            }
        }
    ) { padding ->
        NavHost(navController, startDestination = startDestination, Modifier.padding(padding)) {
            composable("check_profile") {
                LaunchedEffect(Unit) {
                    val user = auth.currentUser
                    if (user != null) {
                        db.collection("users").document(user.uid).get()
                            .addOnSuccessListener { document ->
                                if (document.exists()) {
                                    navController.navigate("feed") { popUpTo("check_profile") { inclusive = true } }
                                } else {
                                    navController.navigate("setup_profile") { popUpTo("check_profile") { inclusive = true } }
                                }
                            }
                            .addOnFailureListener {
                                navController.navigate("setup_profile") { popUpTo("check_profile") { inclusive = true } }
                            }
                    } else {
                        navController.navigate("login") { popUpTo("check_profile") { inclusive = true } }
                    }
                }
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = BrandOrange)
                }
            }
            composable("login") {
                LoginScreen(auth) {
                    navController.navigate("check_profile") { popUpTo("login") { inclusive = true } }
                }
            }
            composable("setup_profile") {
                SetupProfileScreen(auth, db) {
                    navController.navigate("feed") { popUpTo("setup_profile") { inclusive = true } }
                }
            }
            composable("feed") { FeedScreen(db) }
            composable("proximity") { ProximityScreen(auth, db) }
            composable("profile") { ProfileScreen(auth, db, navController) }
        }
    }
}

@Composable
fun SetupProfileScreen(auth: FirebaseAuth, db: FirebaseFirestore, onSetupComplete: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }

    val availableTags = listOf("Runner", "Gamer", "Social", "Cyclist", "Hiker", "Gym")
    val selectedTags = remember { mutableStateListOf<String>() }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val locationPermissionLauncher = rememberLauncherForActivityResult(contract = ActivityResultContracts.RequestPermission()) { isGranted ->
        if (isGranted) {
            isSaving = true
            scope.launch {
                val uid = auth.currentUser!!.uid
                val googlePhoto = auth.currentUser?.photoUrl.toString()
                val locationString = getCityCountry(context)
                saveUserToFirestore(db, uid, name, googlePhoto, description, selectedTags, locationString, onSetupComplete)
            }
        } else {
            Toast.makeText(context, "Location permission needed for auto-detect", Toast.LENGTH_SHORT).show()
            isSaving = false
        }
    }

    LaunchedEffect(Unit) { auth.currentUser?.displayName?.let { name = it } }

    Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("Setup Profile", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = BrandOrange)
        Spacer(Modifier.height(32.dp))

        val photoUrl = auth.currentUser?.photoUrl
        Box(Modifier.size(100.dp).clip(CircleShape).background(Color.LightGray), contentAlignment = Alignment.Center) {
            if (photoUrl != null) {
                AsyncImage(
                    model = photoUrl,
                    contentDescription = "Profile Picture",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                Text(
                    name.firstOrNull()?.toString()?.uppercase() ?: "?",
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        Spacer(Modifier.height(24.dp))
        Text(text = name.ifEmpty { "User" }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(text = "Name provided by Google", style = MaterialTheme.typography.bodySmall, color = Color.Gray)

        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            label = { Text("Bio / Description") },
            modifier = Modifier.fillMaxWidth(),
            maxLines = 3
        )

        Spacer(Modifier.height(24.dp))
        Text("Interests", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.Start))

        Spacer(Modifier.height(8.dp))
        @OptIn(ExperimentalLayoutApi::class)
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            availableTags.forEach { tag ->
                val isSelected = selectedTags.contains(tag)
                FilterChip(
                    selected = isSelected,
                    onClick = { if (isSelected) selectedTags.remove(tag) else selectedTags.add(tag) },
                    label = { Text(tag) },
                    leadingIcon = if (isSelected) { { Icon(Icons.Default.Check, null, modifier = Modifier.size(16.dp)) } } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BrandOrange.copy(alpha = 0.2f),
                        selectedLabelColor = BrandOrange
                    )
                )
            }
        }

        Spacer(Modifier.height(48.dp))

        if (isSaving) {
            CircularProgressIndicator(color = BrandOrange)
        } else {
            Button(
                onClick = {
                    if (name.isNotEmpty()) {
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                            isSaving = true
                            scope.launch {
                                val uid = auth.currentUser!!.uid
                                val googlePhoto = auth.currentUser?.photoUrl.toString()
                                val locationString = getCityCountry(context)
                                saveUserToFirestore(db, uid, name, googlePhoto, description, selectedTags, locationString, onSetupComplete)
                            }
                        } else {
                            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        }
                    } else {
                        Toast.makeText(context, "Name is required", Toast.LENGTH_SHORT).show()
                    }
                },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandOrange)
            ) {
                Text("Complete Setup")
            }
        }
    }
}

@SuppressLint("MissingPermission")
suspend fun getCityCountry(context: Context): String {
    return withContext(Dispatchers.IO) {
        try {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                return@withContext "Unknown Location"
            }

            var location: android.location.Location? = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            if (location == null) {
                location = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            }

            if (location != null) {
                val geocoder = Geocoder(context, Locale.getDefault())
                val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
                if (!addresses.isNullOrEmpty()) {
                    val address = addresses[0]
                    val city = address.locality ?: address.subAdminArea ?: "Unknown City"
                    val country = address.countryName ?: ""
                    return@withContext "$city, $country"
                }
            }
            return@withContext "Unknown Location"
        } catch (e: Exception) {
            Log.e("Location", "Geocoding error", e)
            return@withContext "Unknown Location"
        }
    }
}

fun saveUserToFirestore(
    db: FirebaseFirestore,
    uid: String,
    name: String,
    photoUrl: String,
    description: String,
    tags: List<String>,
    location: String,
    onSuccess: () -> Unit
) {
    val userProfile = UserProfile(
        uid = uid,
        displayName = name,
        email = "",
        photoUrl = photoUrl,
        description = description,
        tags = tags,
        location = location,
        createdAt = System.currentTimeMillis()
    )

    Log.d("Firestore", "Attempting to save user: $uid")

    db.collection("users").document(uid).set(userProfile)
        .addOnSuccessListener {
            Log.d("Firestore", "User saved successfully!")
            onSuccess()
        }
        .addOnFailureListener {
            Log.e("Firestore", "Error saving user", it)
        }
}

@Composable
fun LoginScreen(auth: FirebaseAuth, onLoginSuccess: () -> Unit) {
    val context = LocalContext.current
    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val credential = GoogleAuthProvider.getCredential(account.idToken, null)
            auth.signInWithCredential(credential).addOnCompleteListener {
                if (it.isSuccessful) onLoginSuccess()
            }
        } catch (e: ApiException) { }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Row(horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.DirectionsRun, null, tint = BrandOrange, modifier = Modifier.size(50.dp))
            Spacer(Modifier.width(12.dp))
            Icon(Icons.Default.SportsEsports, null, tint = TagBlue, modifier = Modifier.size(50.dp))
            Spacer(Modifier.width(12.dp))
            Icon(Icons.Default.Groups, null, tint = TagRed, modifier = Modifier.size(50.dp))
        }

        Spacer(Modifier.height(24.dp))
        Text("ActiveConnect", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = BrandOrange)
        Text("Connect, Play & Run Together", style = MaterialTheme.typography.bodyMedium, color = Color.Gray)

        Spacer(Modifier.height(48.dp))

        Button(
            onClick = {
                try {
                    val webClientId = context.getString(
                        context.resources.getIdentifier("default_web_client_id", "string", context.packageName)
                    )
                    val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken(webClientId)
                        .requestEmail()
                        .build()
                    val client = GoogleSignIn.getClient(context, gso)
                    googleSignInLauncher.launch(client.signInIntent)
                } catch (e: Exception) {
                    Toast.makeText(context, "Config Error", Toast.LENGTH_LONG).show()
                }
            },
            modifier = Modifier.fillMaxWidth().height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BrandOrange),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text("Sign in with Google", fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(auth: FirebaseAuth, db: FirebaseFirestore, navController: NavController) {
    val user = auth.currentUser
    var userProfile by remember { mutableStateOf<UserProfile?>(null) }

    LaunchedEffect(user) {
        user?.let {
            db.collection("users").document(it.uid).get()
                .addOnSuccessListener { doc ->
                    if (doc.exists()) {
                        userProfile = doc.toObject(UserProfile::class.java)
                    }
                }
        }
    }

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Avatar
        Box(Modifier.size(120.dp).clip(CircleShape).background(Color.LightGray), contentAlignment = Alignment.Center) {
            val photoUrl = userProfile?.photoUrl ?: user?.photoUrl
            if (photoUrl != null) {
                AsyncImage(
                    model = photoUrl,
                    contentDescription = "Profile Picture",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            } else {
                Text(user?.displayName?.firstOrNull()?.toString()?.uppercase() ?: "?", fontSize = 40.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }

        Spacer(Modifier.height(24.dp))

        Text(user?.displayName ?: "Guest", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)

        if (!userProfile?.location.isNullOrEmpty()) {
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.LocationOn, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(userProfile!!.location, color = Color.Gray, style = MaterialTheme.typography.bodyMedium)
            }
        }

        if (!userProfile?.description.isNullOrEmpty()) {
            Spacer(Modifier.height(16.dp))
            Text(
                userProfile!!.description,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = Color.DarkGray
            )
        }

        Spacer(Modifier.height(24.dp))

        if (userProfile?.tags?.isNotEmpty() == true) {
            FlowRow(
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth()
            ) {
                userProfile!!.tags.forEach { tag ->
                    AssistChip(
                        onClick = { },
                        label = { Text(tag) },
                        modifier = Modifier.padding(4.dp),
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = BrandOrange.copy(alpha = 0.1f),
                            labelColor = BrandOrange
                        ),
                        border = null
                    )
                }
            }
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = {
                auth.signOut()
                navController.navigate("login") {
                    popUpTo("feed") { inclusive = true }
                }
            },
            colors = ButtonDefaults.buttonColors(containerColor = Color.Red),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.ExitToApp, null)
            Spacer(Modifier.width(8.dp))
            Text("Logout")
        }

        Spacer(Modifier.height(32.dp))
    }
}

@Composable
fun FeedScreen(db: FirebaseFirestore) {
    var posts by remember { mutableStateOf<List<ActivityPost>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        db.collection("activities")
            .orderBy("time_start", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e("Feed", "Listen failed", e)
                    isLoading = false
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val newPosts = snapshot.documents.mapNotNull { doc ->
                        try {
                            val type = doc.getString("type") ?: "Activity"
                            val description = doc.getString("description") ?: ""
                            val participants = doc.get("participants") as? List<String> ?: emptyList()
                            val locationMap = doc.get("location") as? Map<String, Double>
                            val lat = locationMap?.get("lat") ?: 0.0
                            val lng = locationMap?.get("lng") ?: 0.0
                            val timestamp = doc.getTimestamp("time_start")

                            val timeAgo = if (timestamp != null) {
                                DateUtils.getRelativeTimeSpanString(timestamp.toDate().time).toString()
                            } else "Just now"

                            val isRun = type.lowercase().contains("run")
                            val avatarColor = if (isRun) Color.Cyan else Color.Magenta

                            ActivityPost(
                                id = doc.id,
                                userName = "User",
                                userAvatarColor = avatarColor,
                                activityType = type.replaceFirstChar { it.uppercase() },
                                timeAgo = timeAgo,
                                location = "Lat: ${String.format("%.2f", lat)}, Lng: ${String.format("%.2f", lng)}",
                                lat = lat,
                                lng = lng,
                                title = type.uppercase(),
                                description = description,
                                friends = participants
                            )
                        } catch (e: Exception) {
                            Log.e("Feed", "Error parsing post: ${doc.id}", e)
                            null
                        }
                    }
                    posts = newPosts
                    isLoading = false
                }
            }
    }

    Column(modifier = Modifier.fillMaxSize().background(LightGrayBg)) {
        Text(
            "Activity Feed",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(16.dp)
        )

        if (isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandOrange)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(posts) { post ->
                    ActivityCard(post)
                }
            }
        }
    }
}

@Composable
fun ActivityCard(post: ActivityPost) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp), shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(post.userAvatarColor))
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(post.userName, fontWeight = FontWeight.Bold); Text("${post.timeAgo} • ${post.location}", color = Color.Gray)
                }
            }
            Spacer(Modifier.height(16.dp))
            Box(Modifier.height(200.dp).fillMaxWidth().clip(RoundedCornerShape(8.dp))) { OsmMapView() }
            Spacer(Modifier.height(16.dp))
            Text(post.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(post.description, color = Color.DarkGray)
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth().border(1.dp, Color(0xFFFFCCBC), RoundedCornerShape(8.dp)).background(Color(0xFFFFFBE6), RoundedCornerShape(8.dp)).padding(12.dp)) { Icon(Icons.Default.Group, null, tint = BrandOrange); Spacer(Modifier.width(8.dp)); Text("Done with Friends", color = BrandOrange) }
        }
    }
}

@Composable
fun OsmMapView() {
    val context = LocalContext.current
    AndroidView(factory = { MapView(it).apply { setTileSource(TileSourceFactory.MAPNIK); controller.setZoom(15.0); controller.setCenter(GeoPoint(50.0, 19.0)) } }, modifier = Modifier.fillMaxSize())
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LobbyScreen(
    myLocation: Location,
    onActivityPosted: () -> Unit,
    onCancel: () -> Unit
) {
    val auth = com.google.firebase.ktx.Firebase.auth
    val db = com.google.firebase.ktx.Firebase.firestore

    var description by remember { mutableStateOf("") }
    val selectedTags = remember { mutableStateListOf<String>() }
    var isPosting by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(Color.White)
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF4CAF50), modifier = Modifier.size(80.dp))
        Spacer(Modifier.height(16.dp))
        Text("Match Successful!", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = Color(0xFF4CAF50))
        Text("Create an activity for this session.", color = Color.Gray)

        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            label = { Text("What are you doing?") },
            modifier = Modifier.fillMaxWidth(),
            maxLines = 3
        )

        Spacer(Modifier.height(24.dp))

        Text("Select Tags", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.align(Alignment.Start))
        Spacer(Modifier.height(8.dp))

        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            AVAILABLE_TAGS.forEach { tag ->
                val isSelected = selectedTags.contains(tag)
                FilterChip(
                    selected = isSelected,
                    onClick = { if (isSelected) selectedTags.remove(tag) else selectedTags.add(tag) },
                    label = { Text(tag) },
                    leadingIcon = if (isSelected) { { Icon(Icons.Default.Check, null, modifier = Modifier.size(16.dp)) } } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BrandOrange.copy(alpha = 0.2f),
                        selectedLabelColor = BrandOrange
                    )
                )
            }
        }

        Spacer(Modifier.height(48.dp))

        if (isPosting) {
            CircularProgressIndicator(color = BrandOrange)
        } else {
            Button(
                onClick = {
                    if (selectedTags.isNotEmpty()) {
                        isPosting = true
                        val activityData = hashMapOf(
                            "description" to description,
                            "tags" to selectedTags,
                            "type" to selectedTags.first().replaceFirstChar { it.uppercase() },
                            "location" to mapOf("lat" to myLocation.latitude, "lng" to myLocation.longitude),
                            "participants" to listOf(auth.currentUser?.displayName ?: "User"),
                            "time_start" to com.google.firebase.Timestamp.now()
                        )

                        db.collection("activities").add(activityData)
                            .addOnSuccessListener {
                                onActivityPosted()
                            }
                            .addOnFailureListener { e ->
                                isPosting = false
                                Log.e("Lobby", "Error posting", e)
                            }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = BrandOrange),
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Post Activity", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(16.dp))

            TextButton(onClick = onCancel) {
                Text("Cancel", color = Color.Gray)
            }
        }
    }
}

// --- SCREEN: PROXIMITY ---
@Composable
fun ProximityScreen(auth: FirebaseAuth, db: FirebaseFirestore) {
    var isSearching by remember { mutableStateOf(false) }
    var connectionStatus by remember { mutableStateOf("Ready to connect") }

    // States
    var hasMet by remember { mutableStateOf(false) }
    var showLobby by remember { mutableStateOf(false) }

    var connectedEndpointId by remember { mutableStateOf<String?>(null) }
    var myLocation by remember { mutableStateOf<Location?>(null) }
    var friendLocation by remember { mutableStateOf<Location?>(null) }

    var myAzimuth by remember { mutableFloatStateOf(0f) }
    var targetBearing by remember { mutableStateOf<Float?>(null) }
    var targetDistance by remember { mutableStateOf<Float?>(null) }

    val context = LocalContext.current

    // 1. Compass
    CompassEffect { azimuth -> myAzimuth = azimuth }

    // 2. Active GPS
    LocationUpdatesEffect(isActive = isSearching || connectedEndpointId != null) { loc ->
        myLocation = loc
    }

    // 3. Math & Logic
    LaunchedEffect(myLocation, friendLocation) {
        val loc = myLocation // Capture local reference to prevent null changes
        val friendLoc = friendLocation

        if (loc != null && friendLoc != null) {
            val dist = loc.distanceTo(friendLoc)
            val bear = loc.bearingTo(friendLoc)

            targetDistance = dist
            targetBearing = bear

            // 10m Threshold for Success
            if (dist < 10.0) {
                hasMet = true
                connectionStatus = "Success! You found each other!"
            } else {
                // Fixed String Formatting to avoid Crash
                val acc = loc.accuracy.roundToInt()
                connectionStatus = "Distance: ${dist.roundToInt()}m (GPS Error: ±${acc}m)"
            }
        }
    }

    val nearbyManager = remember {
        NearbyManager(
            context = context,
            onStatusUpdate = { status -> connectionStatus = status },
            onLocationReceived = { lat, lng ->
                // Friend sent their location
                val fLoc = Location("friend").apply { latitude = lat; longitude = lng }
                friendLocation = fLoc
            },
            onConnected = { endpointId ->
                connectedEndpointId = endpointId
            }
        )
    }

    // 4. Loop: Send my location to friend
    LaunchedEffect(connectedEndpointId, myLocation) {
        val loc = myLocation
        if (connectedEndpointId != null && loc != null) {
            while(true) {
                nearbyManager.sendLocation(loc.latitude, loc.longitude, connectedEndpointId!!)
                delay(500) // Update every 500ms
            }
        }
    }

    DisposableEffect(Unit) { onDispose { nearbyManager.stopAll() } }

    val permissionsToRequest = remember {
        mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION).apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.NEARBY_WIFI_DEVICES)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                add(Manifest.permission.BLUETOOTH_SCAN)
                add(Manifest.permission.BLUETOOTH_ADVERTISE)
                add(Manifest.permission.BLUETOOTH_CONNECT)
            }
        }.toTypedArray()
    }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
        if (perms.values.all { it }) {
            if (!isLocationEnabled(context)) {
                context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            } else {
                isSearching = true
                connectionStatus = "Starting..."
                val randomUser = "User-${(1000..9999).random()}"
                nearbyManager.startAdvertising(randomUser)
                nearbyManager.startDiscovery()
            }
        }
    }

    // Animation
    val rotation by animateFloatAsState(
        targetValue = if (targetBearing != null) (targetBearing!! - myAzimuth).let { if (it < 0) it + 360 else it } else 0f,
        animationSpec = tween(300),
        label = "Compass"
    )

    // --- UI RENDERING ---

    if (showLobby && myLocation != null) {
        // 3. LOBBY SCREEN (Uses captured non-null location)
        LobbyScreen(
            myLocation = myLocation!!,
            onActivityPosted = {
                // Reset all
                showLobby = false
                hasMet = false
                isSearching = false
                connectedEndpointId = null
                targetBearing = null
                targetDistance = null
                nearbyManager.stopAll()
                connectionStatus = "Ready to connect"
            },
            onCancel = {
                showLobby = false
            }
        )
    } else if (hasMet) {
        // 2. SUCCESS SCREEN
        Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(Icons.Default.CheckCircle, null, modifier = Modifier.size(120.dp), tint = Color(0xFF4CAF50))
            Spacer(Modifier.height(24.dp))
            Text("You Matched!", style = MaterialTheme.typography.displayMedium, fontWeight = FontWeight.Bold, color = Color(0xFF4CAF50))
            Text("You are within 10 meters.", color = Color.Gray)

            Spacer(Modifier.height(48.dp))

            // Button to Create Activity (Go to Lobby)
            Button(
                onClick = { showLobby = true },
                colors = ButtonDefaults.buttonColors(containerColor = BrandOrange),
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Create Activity", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(16.dp))

            // Button to just Close
            OutlinedButton(
                onClick = {
                    hasMet = false
                    isSearching = false
                    connectedEndpointId = null
                    targetBearing = null
                    targetDistance = null
                    nearbyManager.stopAll()
                    connectionStatus = "Ready to connect"
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, BrandOrange),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandOrange)
            ) {
                Text("Close", fontSize = 18.sp)
            }
        }
    } else {
        // 1. RADAR / COMPASS SCREEN
        Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Box(contentAlignment = Alignment.Center) {
                if (isSearching && targetBearing == null) {
                    CircularProgressIndicator(modifier = Modifier.size(200.dp), color = BrandOrange.copy(alpha = 0.3f), strokeWidth = 8.dp)
                    Icon(Icons.Default.Radar, null, modifier = Modifier.size(80.dp), tint = BrandOrange)
                }
                else if (targetBearing != null) {
                    Icon(Icons.Default.Navigation, null, modifier = Modifier.size(200.dp).rotate(rotation), tint = BrandOrange)
                    Text(
                        "${targetDistance?.roundToInt()}m",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.BottomCenter).offset(y = 80.dp)
                    )
                }
                else {
                    Icon(Icons.Default.Radar, null, modifier = Modifier.size(80.dp), tint = Color.Gray)
                }
            }

            Spacer(Modifier.height(100.dp))

            Text(
                text = if(targetDistance != null) "Tracking..." else connectionStatus,
                textAlign = TextAlign.Center,
                color = BrandOrange,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 32.dp)
            )

            if (!isSearching && targetBearing == null) {
                Button(
                    onClick = {
                        if (hasRequiredPermissions(context)) {
                            if (!isLocationEnabled(context)) {
                                context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
                            } else {
                                isSearching = true
                                connectionStatus = "Starting..."
                                // Random user ID to avoid collision in logic
                                val randomUser = "User-${(1000..9999).random()}"
                                nearbyManager.startAdvertising(randomUser)
                                nearbyManager.startDiscovery()
                            }
                        } else {
                            launcher.launch(permissionsToRequest)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandOrange),
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Connect", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                OutlinedButton(
                    onClick = {
                        isSearching = false
                        targetBearing = null // FIXED: Reset compass state
                        targetDistance = null // FIXED: Reset distance state
                        connectedEndpointId = null
                        nearbyManager.stopAll()
                        connectionStatus = "Ready to connect" // Reset text
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    border = BorderStroke(1.dp, BrandOrange),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandOrange)
                ) {
                    Text("Cancel", fontSize = 18.sp)
                }
            }
        }
    }
}