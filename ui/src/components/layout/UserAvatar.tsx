import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';

export function UserAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getUserProfile() {
      try {
        setLoading(true);
        setError(null);
        
        // Get the current user and session
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log('User data:', user);
        console.log('Session data:', session);
        
        if (!user) {
          setError('No user found');
          return;
        }

        // Try multiple approaches to find the avatar URL
        let foundAvatarUrl = null;
        
        // Approach 1: Check user metadata (most common location)
        console.log('User metadata:', user.user_metadata);
        if (user.user_metadata?.avatar_url) {
          console.log('Found avatar in user_metadata.avatar_url');
          foundAvatarUrl = user.user_metadata.avatar_url;
        } else if (user.user_metadata?.picture) {
          console.log('Found avatar in user_metadata.picture');
          foundAvatarUrl = user.user_metadata.picture;
        }
        
        // Approach 2: Check if avatar URL is directly on the user object
        if (!foundAvatarUrl && user.user_metadata?.picture) {
          console.log('Found avatar directly on user object');
          foundAvatarUrl = user.user_metadata.picture;
        }
        
        // Approach 3: Check app metadata
        console.log('App metadata:', user.app_metadata);
        if (!foundAvatarUrl && user.app_metadata?.avatar_url) {
          console.log('Found avatar in app_metadata.avatar_url');
          foundAvatarUrl = user.app_metadata.avatar_url;
        }
        
        // Approach 4: Check identities array (most reliable for OAuth providers)
        if (!foundAvatarUrl) {
          const identities = user.identities;
          console.log('User identities:', identities);
          
          if (identities && identities.length > 0) {
            // Try to find Google identity first
            const googleIdentity = identities.find(
              (identity) => identity.provider === 'google'
            );
            
            console.log('Google identity:', googleIdentity);
            
            if (googleIdentity && googleIdentity.identity_data) {
              console.log('Identity data:', googleIdentity.identity_data);
              
              // Try different possible field names
              if (googleIdentity.identity_data.avatar_url) {
                console.log('Found avatar in identity_data.avatar_url');
                foundAvatarUrl = googleIdentity.identity_data.avatar_url;
              } else if (googleIdentity.identity_data.picture) {
                console.log('Found avatar in identity_data.picture');
                foundAvatarUrl = googleIdentity.identity_data.picture;
              }
            }
          }
        }
        
        // For Google profile images, ensure we're using the correct URL format
        // Sometimes Google returns a URL that needs modification to work properly
        if (foundAvatarUrl && foundAvatarUrl.includes('googleusercontent.com')) {
          console.log('Found Google profile image URL, ensuring correct format');
          // Remove any size restrictions that might cause issues
          foundAvatarUrl = foundAvatarUrl.replace(/=s\d+-c/, '=s256-c');
          console.log('Modified Google URL:', foundAvatarUrl);
        }
        
        // Set the avatar URL if found
        if (foundAvatarUrl) {
          console.log('Setting avatar URL:', foundAvatarUrl);
          setAvatarUrl(foundAvatarUrl);
        } else {
          console.log('No avatar URL found');
          setError('No avatar URL found');
        }
      } catch (error: any) {
        console.error('Error fetching user profile:', error);
        setError(error.message || 'Error fetching profile');
      } finally {
        setLoading(false);
      }
    }

    getUserProfile();
  }, []);

  // For debugging purposes, let's log the state in render
  console.log('Render state:', { avatarUrl, loading, error });
  
  // If we're still loading or have an error, show appropriate UI
  if (loading) {
    return (
      <Avatar className="h-8 w-8">
        <AvatarFallback>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className="h-8 w-8">
      {avatarUrl ? (
        <AvatarImage 
          src={avatarUrl} 
          alt="User profile" 
          onError={(e) => {
            console.error('Error loading image from URL:', avatarUrl);
            // Log the specific error
            console.error('Image error:', e);
            setAvatarUrl(null);
          }}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      ) : (
        <AvatarFallback>
          <User className="h-4 w-4" />
        </AvatarFallback>
      )}
    </Avatar>
  );
}
