package com.example.bit_festival

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import org.osmdroid.views.MapView
import java.util.Locale
import java.util.UUID

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
    val id: Int,
    val userName: String,
    val userAvatarColor: Color,
    val activityType: String,
    val timeAgo: String,
    val location: String,
    val title: String,
    val description: String,
    val stats: ActivityStats,
    val friends: List<String>
)

data class ActivityStats(
    val duration: String,
    val distance: String,
    val pace: String,
    val calories: String
)

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

        // Initialize Proximity Manager
        val nearbyManager = NearbyManager(this)

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = BrandOrange,
                    background = LightGrayBg,
                    surface = Color.White
                )
            ) {
                // Determine start destination based on Auth state
                // If logged in -> Check Profile. If not -> Login.
                val startDest = if (auth.currentUser != null) "check_profile" else "login"
                MainApp(nearbyManager, auth, db, startDest)
            }
        }
    }
}

@Composable
fun MainApp(
    nearbyManager: NearbyManager,
    auth: FirebaseAuth,
    db: FirebaseFirestore,
    startDestination: String
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Screens that should NOT show the bottom navigation bar
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
            // 1. ROUTING LOGIC SCREEN (Invisible to user usually)
            composable("check_profile") {
                LaunchedEffect(Unit) {
                    val user = auth.currentUser
                    if (user != null) {
                        // Check if user doc exists in Firestore
                        db.collection("users").document(user.uid).get()
                            .addOnSuccessListener { document ->
                                if (document.exists()) {
                                    // User exists, go to Feed
                                    navController.navigate("feed") { popUpTo("check_profile") { inclusive = true } }
                                } else {
                                    // No profile found, force Setup
                                    navController.navigate("setup_profile") { popUpTo("check_profile") { inclusive = true } }
                                }
                            }
                            .addOnFailureListener {
                                // On offline/error, default to setup just in case to avoid dead ends
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

            // 2. LOGIN SCREEN
            composable("login") {
                LoginScreen(auth) {
                    // Go to check profile to route correctly
                    navController.navigate("check_profile") { popUpTo("login") { inclusive = true } }
                }
            }

            // 3. SETUP PROFILE SCREEN
            composable("setup_profile") {
                SetupProfileScreen(auth, db) {
                    navController.navigate("feed") { popUpTo("setup_profile") { inclusive = true } }
                }
            }

            // 4. MAIN APP SCREENS
            composable("feed") { FeedScreen() }
            composable("proximity") { ProximityScreen(nearbyManager) }
            composable("profile") { ProfileScreen(auth, db, navController) }
        }
    }
}

// --- SCREEN: SETUP PROFILE ---
@Composable
fun SetupProfileScreen(
    auth: FirebaseAuth,
    db: FirebaseFirestore,
    onSetupComplete: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }

    val availableTags = listOf("Runner", "Gamer", "Social", "Cyclist", "Hiker", "Gym")
    val selectedTags = remember { mutableStateListOf<String>() }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Setup permission launcher for location
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            // If granted after request, try saving again immediately
            isSaving = true
            scope.launch {
                val uid = auth.currentUser!!.uid
                val googlePhoto = auth.currentUser?.photoUrl.toString()
                // Fetch location string
                val locationString = getCityCountry(context)

                saveUserToFirestore(
                    db, uid, name, googlePhoto, description, selectedTags, locationString, onSetupComplete
                )
            }
        } else {
            Toast.makeText(context, "Location permission needed to auto-detect city", Toast.LENGTH_SHORT).show()
            isSaving = false
        }
    }

    // Pre-fill name from Google Auth - ALWAYS use this
    LaunchedEffect(Unit) {
        auth.currentUser?.displayName?.let { name = it }
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Setup Profile", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = BrandOrange)
        Spacer(Modifier.height(8.dp))
        Text("Complete your account details.", color = Color.Gray)

        Spacer(Modifier.height(32.dp))

        // Display Google Avatar (Read-only)
        val photoUrl = auth.currentUser?.photoUrl
        Box(
            Modifier
                .size(100.dp)
                .clip(CircleShape)
                .background(Color.LightGray),
            contentAlignment = Alignment.Center
        ) {
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

        // Name Display (Read Only)
        Text(
            text = name.ifEmpty { "User" },
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = Color.Black
        )
        Text(
            text = "Name provided by Google",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )

        Spacer(Modifier.height(24.dp))

        // Description Field
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
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            availableTags.forEach { tag ->
                val isSelected = selectedTags.contains(tag)
                FilterChip(
                    selected = isSelected,
                    onClick = {
                        if (isSelected) selectedTags.remove(tag) else selectedTags.add(tag)
                    },
                    label = { Text(tag) },
                    leadingIcon = if (isSelected) {
                        { Icon(Icons.Default.Check, null, modifier = Modifier.size(16.dp)) }
                    } else null,
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
                        // Check location permission
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                            isSaving = true
                            scope.launch {
                                val uid = auth.currentUser!!.uid
                                val googlePhoto = auth.currentUser?.photoUrl.toString()

                                // Fetch location string in background
                                val locationString = getCityCountry(context)

                                saveUserToFirestore(
                                    db, uid, name, googlePhoto, description, selectedTags, locationString, onSetupComplete
                                )
                            }
                        } else {
                            // Request Permission
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

// Helper to get readable location (City, Country)
@SuppressLint("MissingPermission")
suspend fun getCityCountry(context: Context): String {
    return withContext(Dispatchers.IO) {
        try {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            // Check permissions again just in case
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                return@withContext "Unknown Location"
            }

            // Try to get last known location
            var location: android.location.Location? = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            if (location == null) {
                location = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            }

            if (location != null) {
                val geocoder = Geocoder(context, Locale.getDefault())
                // Get 1 address result
                val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
                if (!addresses.isNullOrEmpty()) {
                    val address = addresses[0]
                    // Return "City, Country"
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

// --- SCREEN: LOGIN ---
@Composable
fun LoginScreen(auth: FirebaseAuth, onLoginSuccess: () -> Unit) {
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val credential = GoogleAuthProvider.getCredential(account.idToken, null)
            isLoading = true
            auth.signInWithCredential(credential).addOnCompleteListener { authTask ->
                isLoading = false
                if (authTask.isSuccessful) {
                    onLoginSuccess()
                } else {
                    errorMessage = authTask.exception?.message ?: "Google Sign-In failed"
                }
            }
        } catch (e: ApiException) {
            errorMessage = "Google Sign-In Error: ${e.statusCode}"
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Logo Row
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

        if (errorMessage != null) {
            Text(errorMessage!!, color = Color.Red, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
            Spacer(Modifier.height(16.dp))
        }

        if (isLoading) {
            CircularProgressIndicator(color = BrandOrange)
        } else {
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
                        val googleSignInClient = GoogleSignIn.getClient(context, gso)
                        googleSignInLauncher.launch(googleSignInClient.signInIntent)
                    } catch (e: Exception) {
                        errorMessage = "Config Error: Check google-services.json"
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
}

// --- HELPER: PERMISSIONS CHECK ---
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

// --- SCREEN: PROFILE ---
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(auth: FirebaseAuth, db: FirebaseFirestore, navController: NavController) {
    val user = auth.currentUser
    var userProfile by remember { mutableStateOf<UserProfile?>(null) }

    // Fetch Profile Data
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
        // Removed verticalArrangement to allow natural flow
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

        // Name
        Text(user?.displayName ?: "Guest", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)

        // Location (if available)
        if (!userProfile?.location.isNullOrEmpty()) {
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.LocationOn, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(userProfile!!.location, color = Color.Gray, style = MaterialTheme.typography.bodyMedium)
            }
        }

        // Bio / Description (if available)
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

        // Tags (if available)
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
                        // FIXED: Removed conflicting border call to fix type mismatch/composable error
                        border = null
                    )
                }
            }
        }

        Spacer(Modifier.weight(1f)) // Push logout to bottom

        // Logout Button
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

// --- SCREEN: FEED ---
@Composable
fun FeedScreen() {
    val posts = listOf(
        ActivityPost(1, "Sarah Johnson", Color.Cyan, "running", "2 hours ago", "Planty Park, Krakow", "Morning Run", "Perfect morning for a run!", ActivityStats("42:15", "8.2 km", "5:09 /km", "524 kcal"), listOf("Mark", "James")),
        ActivityPost(2, "Mark Thompson", Color.Magenta, "social", "5 hours ago", "Old Town, Krakow", "Coffee Break", "Catching up with old friends.", ActivityStats("1:10:00", "0.0 km", "-", "150 kcal"), listOf("Sarah"))
    )

    LazyColumn(modifier = Modifier.fillMaxSize().background(LightGrayBg), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Text("Activity Feed", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp)) }
        items(posts) { post -> ActivityCard(post) }
    }
}

// --- COMPONENT: ACTIVITY CARD ---
@Composable
fun ActivityCard(post: ActivityPost) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp), shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(CircleShape).background(post.userAvatarColor))
                Spacer(Modifier.width(12.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(post.userName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge)
                        Spacer(Modifier.width(8.dp))
                        val tagColor = if(post.activityType == "running") TagBlue else TagRed
                        Surface(color = tagColor, shape = RoundedCornerShape(4.dp)) {
                            Row(Modifier.padding(horizontal = 6.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(if(post.activityType == "running") Icons.Default.DirectionsRun else Icons.Default.Coffee, null, tint = Color.White, modifier = Modifier.size(12.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(post.activityType, color = Color.White, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                    Text("${post.timeAgo} • ${post.location}", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                }
            }
            Spacer(Modifier.height(16.dp))
            Box(Modifier.height(200.dp).fillMaxWidth().clip(RoundedCornerShape(8.dp))) { OsmMapView() }
            Spacer(Modifier.height(16.dp))
            Text(post.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(post.description, style = MaterialTheme.typography.bodyMedium, color = Color.DarkGray, modifier = Modifier.padding(vertical = 4.dp))
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth().background(StatsBg, RoundedCornerShape(8.dp)).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                StatItem(Icons.Outlined.Timer, "Duration", post.stats.duration)
                StatItem(Icons.Outlined.Place, "Distance", post.stats.distance)
                StatItem(Icons.Outlined.Speed, "Pace", post.stats.pace)
                StatItem(Icons.Outlined.LocalFireDepartment, "Calories", post.stats.calories)
            }
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth().border(1.dp, Color(0xFFFFCCBC), RoundedCornerShape(8.dp)).background(Color(0xFFFFFBE6), RoundedCornerShape(8.dp)).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Group, null, tint = BrandOrange)
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("Done with", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                    Text("@markthom, @jameswil", style = MaterialTheme.typography.bodySmall, color = BrandOrange, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(16.dp))
            HorizontalDivider(color = Color.LightGray.copy(alpha = 0.5f))
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                ActionIcon(Icons.Outlined.FavoriteBorder, "23")
                ActionIcon(Icons.Outlined.ChatBubbleOutline, "5")
                ActionIcon(Icons.Outlined.Share, "")
            }
        }
    }
}

@Composable
fun StatItem(icon: ImageVector, label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, modifier = Modifier.size(14.dp), tint = BrandOrange)
            Spacer(Modifier.width(4.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, color = Color.Gray)
        }
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun ActionIcon(icon: ImageVector, count: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Color.Gray)
        if (count.isNotEmpty()) {
            Spacer(Modifier.width(4.dp))
            Text(count, style = MaterialTheme.typography.bodyMedium, color = Color.Gray)
        }
    }
}

@Composable
fun OsmMapView() {
    val context = LocalContext.current
    AndroidView(
        factory = {
            MapView(it).apply {
                setTileSource(TileSourceFactory.MAPNIK)
                setMultiTouchControls(true)
                controller.setZoom(15.0)
                controller.setCenter(GeoPoint(50.0647, 19.9450))
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

// --- SCREEN: PROXIMITY (Offline Connect) ---
@Composable
fun ProximityScreen(nearbyManager: NearbyManager) {
    var isSearching by remember { mutableStateOf(false) }
    val context = LocalContext.current

    // PERMISSION LAUNCHER
    val permissionsToRequest = remember {
        mutableListOf<String>().apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.NEARBY_WIFI_DEVICES)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                add(Manifest.permission.BLUETOOTH_SCAN)
                add(Manifest.permission.BLUETOOTH_ADVERTISE)
                add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }.toTypedArray()
    }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            isSearching = true
            val randomUser = "User-${(1000..9999).random()}"
            nearbyManager.startAdvertising(randomUser)
            nearbyManager.startDiscovery()
        } else {
            Toast.makeText(context, "Permissions required to connect!", Toast.LENGTH_LONG).show()
        }
    }

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (isSearching) {
                CircularProgressIndicator(
                    modifier = Modifier.size(160.dp),
                    color = BrandOrange.copy(alpha = 0.3f),
                    strokeWidth = 8.dp
                )
                CircularProgressIndicator(
                    modifier = Modifier.size(130.dp),
                    color = BrandOrange,
                    strokeWidth = 2.dp
                )
            }
            Icon(
                Icons.Default.Radar,
                null,
                modifier = Modifier.size(80.dp),
                tint = if(isSearching) BrandOrange else Color.Gray
            )
        }

        Spacer(Modifier.height(32.dp))

        Text(
            if (isSearching) "Searching for Activity..." else "Connect Offline",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        Text(
            if (isSearching) "Looking for a nearby partner. Keep the app open."
            else "Click to automatically connect with the first available person near you.",
            textAlign = TextAlign.Center,
            color = Color.Gray,
            modifier = Modifier.padding(top = 8.dp, bottom = 48.dp)
        )

        if (!isSearching) {
            Button(
                onClick = {
                    if (hasRequiredPermissions(context)) {
                        isSearching = true
                        val randomUser = "User-${(1000..9999).random()}"
                        nearbyManager.startAdvertising(randomUser)
                        nearbyManager.startDiscovery()
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
                    nearbyManager.stopAll()
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, BrandOrange),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = BrandOrange)
            ) {
                Text("Cancel", fontSize = 18.sp)
            }
        }
    }
}